create table private.demo_provisions(id uuid primary key,actor_id uuid not null references auth.users,parent_id uuid not null references public.patients,kind text not null check(kind in ('rehearsal','patient_login')),target_id uuid references public.patients,result jsonb,created_at timestamptz not null default now());
alter table private.demo_provisions enable row level security;
revoke all on private.demo_provisions from public,anon,authenticated;
create function private.reserve_demo_provision(p_id uuid,p_parent uuid,p_kind text,p_target uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare existing private.demo_provisions;begin
 if auth.uid() is null or private.patient_role(p_parent) is distinct from 'clinician' or not exists(select 1 from public.patients where id=p_parent and synthetic) then raise exception 'Assigned synthetic clinician required' using errcode='42501';end if;
 perform 1 from public.patients where id=p_parent for update;
 select * into existing from private.demo_provisions where id=p_id;
 if found then if existing.actor_id<>auth.uid() or existing.parent_id<>p_parent or existing.kind<>p_kind or existing.target_id is distinct from p_target then raise exception 'Request conflict';end if;return jsonb_build_object('reserved',false,'result',existing.result);end if;
 if p_id is null or p_kind not in ('rehearsal','patient_login') or (p_kind='rehearsal' and p_target is not null) then raise exception 'Invalid demo request';end if;
 if (select count(*) from private.demo_provisions where actor_id=auth.uid() and created_at>now()-interval '1 day')>=8 then raise exception 'Daily demo limit reached';end if;
 if p_kind='patient_login' and not exists(select 1 from public.patients p join public.patients parent on parent.id=p_parent where p.id=p_target and p.clinic_id=parent.clinic_id and p.synthetic and p.user_id is null and private.patient_role(p.id)='clinician') then raise exception 'Assigned synthetic patient without login required' using errcode='42501';end if;
 insert into private.demo_provisions(id,actor_id,parent_id,kind,target_id) values(p_id,auth.uid(),p_parent,p_kind,p_target);
 return jsonb_build_object('reserved',true);
end$$;
create function public.reserve_demo_provision(p_id uuid,p_parent uuid,p_kind text,p_target uuid default null) returns jsonb language sql security invoker set search_path='' as $$select private.reserve_demo_provision(p_id,p_parent,p_kind,p_target);$$;
revoke all on function private.reserve_demo_provision(uuid,uuid,text,uuid),public.reserve_demo_provision(uuid,uuid,text,uuid) from public,anon;
grant execute on function private.reserve_demo_provision(uuid,uuid,text,uuid),public.reserve_demo_provision(uuid,uuid,text,uuid) to authenticated;
create function private.complete_demo_provision(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.demo_provisions;u uuid;cl uuid;co uuid;cg uuid;p uuid;clinic uuid;answer jsonb;begin
 if auth.jwt()->>'role' is distinct from 'service_role' then raise exception 'Backend only' using errcode='42501';end if;
 select * into r from private.demo_provisions where id=p_id for update;if not found then raise exception 'Reservation required';end if;
 if r.result is not null then return r.result;end if;
 if r.created_at<now()-interval '10 minutes' or not exists(select 1 from private.memberships where patient_id=r.parent_id and user_id=r.actor_id and role='clinician' and active) then raise exception 'Expired or revoked reservation';end if;
 select id into u from auth.users where email='patient-'||p_id||'@wholecare.test';if u is null then raise exception 'Provision Auth identity first';end if;
 select clinic_id into clinic from public.patients where id=r.parent_id and synthetic;
 if r.kind='patient_login' then
  update public.patients set user_id=u where id=r.target_id and user_id is null and synthetic returning id into p;
  if p is null then raise exception 'Patient login already linked';end if;
  insert into public.profiles(id,display_name) select u,display_name from public.patients where id=p;
 else
  select id into cl from auth.users where email='clinician-'||p_id||'@wholecare.test';select id into co from auth.users where email='coordinator-'||p_id||'@wholecare.test';select id into cg from auth.users where email='caregiver-'||p_id||'@wholecare.test';
  if cl is null or co is null or cg is null then raise exception 'Four persona identities required';end if;
  insert into public.patients(clinic_id,user_id,display_name,timezone,synthetic) values(clinic,u,'Rehearsal '||left(p_id::text,8),'UTC',true) returning id into p;
  insert into public.profiles(id,display_name) values(u,'Rehearsal patient'),(cl,'Rehearsal clinician'),(co,'Rehearsal coordinator'),(cg,'Rehearsal caregiver');
  insert into private.memberships(patient_id,user_id,role) values(p,cl,'clinician'),(p,co,'coordinator'),(p,cg,'caregiver'),(p,r.actor_id,'clinician');
 end if;
 answer:=jsonb_build_object('patient_id',p,'synthetic',true,'kind',r.kind);
 update private.demo_provisions set result=answer where id=p_id;return answer;
end$$;
create function public.complete_demo_provision(p_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.complete_demo_provision(p_id);$$;
revoke all on function private.complete_demo_provision(uuid),public.complete_demo_provision(uuid) from public,anon,authenticated;
grant execute on function private.complete_demo_provision(uuid),public.complete_demo_provision(uuid) to service_role;
