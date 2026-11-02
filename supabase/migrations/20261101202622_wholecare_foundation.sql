-- WholeCare development foundation. Applied to the remote development project.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.clinics (
 id uuid primary key default gen_random_uuid(), name text not null,
 created_at timestamptz not null default now()
);
create table public.profiles (
 id uuid primary key references auth.users(id), display_name text not null,
 created_at timestamptz not null default now()
);
create table public.patients (
 id uuid primary key default gen_random_uuid(), clinic_id uuid not null references public.clinics,
 user_id uuid unique references auth.users, display_name text not null,
 synthetic boolean not null default true check (synthetic),
 timezone text not null default 'Asia/Kolkata', language text not null default 'en',
 created_at timestamptz not null default now(), unique(id,clinic_id)
);
create table private.memberships (
 patient_id uuid not null references public.patients, user_id uuid not null references auth.users,
 role text not null check(role in ('clinician','coordinator','caregiver')),
 active boolean not null default true, primary key(patient_id,user_id,role)
);
create index memberships_user_idx on private.memberships(user_id,patient_id);
create table private.caregiver_consents (
 patient_id uuid not null references public.patients, caregiver_id uuid not null references auth.users,
 granted boolean not null default false, updated_at timestamptz not null default now(),
 primary key(patient_id,caregiver_id)
);
create index consent_caregiver_idx on private.caregiver_consents(caregiver_id,patient_id);
create table public.care_plans (
 id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.patients,
 status text not null default 'proposed' check(status in ('proposed','confirmed','cancelled')),
 source_note text not null, confirmed_by uuid references auth.users, confirmed_at timestamptz,
 created_at timestamptz not null default now(), unique(id,patient_id),
 check(status <> 'confirmed' or (confirmed_by is not null and confirmed_at is not null))
);
create table public.care_plan_items (
 id uuid primary key default gen_random_uuid(), plan_id uuid not null, patient_id uuid not null,
 domain text not null check(domain in ('medication','meals','glucose','test')),
 label text not null, cadence text not null default 'once' check(cadence in ('once','daily')),
 requires_human_review boolean not null default false,
 foreign key(plan_id,patient_id) references public.care_plans(id,patient_id),
 unique(id,patient_id), check(domain <> 'test' or requires_human_review)
);
create table public.care_loops (
 id uuid primary key default gen_random_uuid(), item_id uuid not null, patient_id uuid not null,
 due_at timestamptz not null, state text not null default 'DUE'
 check(state in ('DUE','UNCONFIRMED','REVIEW_PENDING','CLOSED')),
 next_owner text not null default 'patient' check(next_owner in ('patient','caregiver','clinician','none')),
 reminded_at timestamptz, closed_at timestamptz, review_note text,
 foreign key(item_id,patient_id) references public.care_plan_items(id,patient_id),
 unique(item_id,due_at), unique(id,patient_id),
 check((state='CLOSED')=(closed_at is not null)),
 check((state='CLOSED')=(next_owner='none'))
);
create index loops_patient_due_idx on public.care_loops(patient_id,due_at);
create index loops_open_idx on public.care_loops(patient_id,state) where state <> 'CLOSED';
create table public.care_events (
 id uuid primary key default gen_random_uuid(), patient_id uuid not null, loop_id uuid not null,
 actor_id uuid not null references auth.users, domain text not null,
 status text not null, details jsonb not null default '{}',
 occurred_at timestamptz not null default now(),
 foreign key(loop_id,patient_id) references public.care_loops(id,patient_id)
);
create table public.glucose_observations (
 id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.patients,
 observed_at timestamptz not null, value numeric not null check(value>0),
 unit text not null check(unit='mg/dL'), source_id text not null,
 synthetic boolean not null default true check(synthetic), unique(patient_id,source_id,observed_at)
);
create table public.evidence (
 id uuid primary key default gen_random_uuid(), patient_id uuid not null, loop_id uuid not null,
 submitted_by uuid not null references auth.users, label text not null,
 storage_path text unique, is_fixture boolean not null default false,
 created_at timestamptz not null default now(),
 foreign key(loop_id,patient_id) references public.care_loops(id,patient_id),
 check(is_fixture or storage_path is not null)
);
create table public.support_tasks (
 id uuid primary key default gen_random_uuid(), patient_id uuid not null, loop_id uuid not null,
 caregiver_id uuid not null references auth.users, label text not null,
 status text not null default 'open' check(status in ('open','done','cancelled')),
 created_at timestamptz not null default now(), unique(loop_id,caregiver_id),
 foreign key(loop_id,patient_id) references public.care_loops(id,patient_id)
);
create table public.message_outbox (
 id uuid primary key default gen_random_uuid(), patient_id uuid not null, loop_id uuid not null,
 recipient_role text not null check(recipient_role in ('patient','caregiver')),
 body text not null, delivery_status text not null default 'simulated' check(delivery_status in ('simulated','pending','sent','failed')),
 created_at timestamptz not null default now(),
 foreign key(loop_id,patient_id) references public.care_loops(id,patient_id)
);
create table public.audit_events (
 id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.patients,
 loop_id uuid references public.care_loops, actor_id uuid not null references auth.users,
 actor_role text not null, action text not null, previous_state text, next_state text,
 note text, event_key uuid not null, created_at timestamptz not null default now(),
 unique(actor_id,event_key)
);
create table private.request_keys (
 actor_id uuid not null references auth.users, event_key uuid not null,
 loop_id uuid, action text not null, result jsonb, primary key(actor_id,event_key)
);

-- Private helpers bypass membership-table RLS only, with explicit authenticated identity checks.
create function private.patient_role(p_patient uuid) returns text language sql stable security definer
 set search_path='' as $$
 select case when auth.uid() is null then null
 when exists(select 1 from public.patients p where p.id=p_patient and p.user_id=auth.uid()) then 'patient'
 else (select m.role from private.memberships m where m.patient_id=p_patient and m.user_id=auth.uid() and m.active and m.role in ('clinician','coordinator') order by m.role limit 1) end;
$$;
create function private.caregiver_allowed(p_patient uuid,p_caregiver uuid) returns boolean language sql stable security definer
 set search_path='' as $$ select auth.uid() is not null and exists(
 select 1 from private.memberships m join private.caregiver_consents c
 on c.patient_id=m.patient_id and c.caregiver_id=m.user_id
 where m.patient_id=p_patient and m.user_id=p_caregiver and m.role='caregiver' and m.active and c.granted
 and (auth.uid()=p_caregiver or private.patient_role(p_patient) in ('patient','coordinator','clinician'))); $$;

-- No direct client mutation grants: all workflow changes pass through the checked transaction below.
do $$ declare t text; begin
 foreach t in array array['clinics','profiles','patients','care_plans','care_plan_items','care_loops','care_events','glucose_observations','evidence','support_tasks','message_outbox','audit_events'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;
 foreach t in array array['memberships','caregiver_consents','request_keys'] loop
 execute format('alter table private.%I enable row level security',t);
 execute format('revoke all on private.%I from anon, authenticated',t);
 end loop;
end $$;
create policy own_profile on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy assigned_clinic on public.clinics for select to authenticated using(exists(select 1 from public.patients p where p.clinic_id=clinics.id and private.patient_role(p.id) is not null));
do $$ declare t text; begin
 foreach t in array array['patients','care_plans','care_plan_items','care_loops','care_events','glucose_observations','evidence','message_outbox','audit_events'] loop
 execute format('create policy assigned_read on public.%I for select to authenticated using(private.patient_role(%I) is not null)',t,case when t='patients' then 'id' else 'patient_id' end);
 end loop;
end $$;
create policy scoped_support on public.support_tasks for select to authenticated using(
 private.patient_role(patient_id) is not null or (caregiver_id=(select auth.uid()) and private.caregiver_allowed(patient_id,caregiver_id))
);

create function private.act(p_loop uuid,p_action text,p_event_key uuid,p_note text default '') returns jsonb
 language plpgsql security definer set search_path='' as $$
declare l public.care_loops; i public.care_plan_items; r text; previous text;
 result_value jsonb; old_request private.request_keys; caregiver uuid; ev uuid;
begin
 if auth.uid() is null or p_event_key is null then raise exception 'Authentication and event key required' using errcode='42501'; end if;
 -- Reservation makes concurrent retries serialize. Failures roll it back with the transaction.
 insert into private.request_keys(actor_id,event_key,loop_id,action) values(auth.uid(),p_event_key,p_loop,p_action) on conflict do nothing;
 if not found then
 select * into old_request from private.request_keys where actor_id=auth.uid() and event_key=p_event_key;
 if old_request.loop_id is distinct from p_loop or old_request.action<>p_action then raise exception 'Event key reused for different request'; end if;
 return old_request.result;
 end if;
 select * into l from public.care_loops where id=p_loop for update;
 if not found then raise exception 'Care loop not accessible' using errcode='42501'; end if;
 -- Locks patient to serialize consent revocation with support routing.
 perform 1 from public.patients where id=l.patient_id for update;
 r:=private.patient_role(l.patient_id);
 if r is null then raise exception 'Care loop not accessible' using errcode='42501'; end if;
 select * into i from public.care_plan_items where id=l.item_id;
 if not exists(select 1 from public.care_plans where id=i.plan_id and status='confirmed') then raise exception 'Plan requires human confirmation'; end if;
 previous:=l.state;
 if p_action='complete' and r='patient' and i.domain in ('medication','meals','glucose') and l.state in ('DUE','UNCONFIRMED') then
 update public.care_loops set state='CLOSED',next_owner='none',closed_at=now() where id=p_loop;
 insert into public.care_events(patient_id,loop_id,actor_id,domain,status,details) values(l.patient_id,p_loop,auth.uid(),i.domain,'self_reported_complete',jsonb_build_object('note',left(p_note,2000),'synthetic',true));
 elsif p_action='evidence' and r='patient' and i.domain='test' and l.state='DUE' then
 insert into public.evidence(patient_id,loop_id,submitted_by,label,is_fixture) values(l.patient_id,p_loop,auth.uid(),'Synthetic report fixture - no clinical findings',true) returning id into ev;
 update public.care_loops set state='REVIEW_PENDING',next_owner='clinician' where id=p_loop;
 elsif p_action='review' and r='clinician' and i.requires_human_review and l.state='REVIEW_PENDING' and length(trim(p_note))>0 then
 if not exists(select 1 from public.evidence where loop_id=p_loop) then raise exception 'Evidence required'; end if;
 update public.care_loops set state='CLOSED',next_owner='none',closed_at=now(),review_note=left(trim(p_note),2000) where id=p_loop;
 elsif p_action='remind' and r='coordinator' and l.state in ('DUE','UNCONFIRMED') and l.reminded_at is null then
 update public.care_loops set reminded_at=now() where id=p_loop;
 insert into public.message_outbox(patient_id,loop_id,recipient_role,body) values(l.patient_id,p_loop,'patient','Reminder: '||i.label||'. Please confirm or ask for support.');
 elsif p_action='support' and r='coordinator' and l.state in ('DUE','UNCONFIRMED') and l.reminded_at is not null and l.next_owner='patient' then
 select m.user_id into caregiver from private.memberships m where m.patient_id=l.patient_id and m.role='caregiver' and private.caregiver_allowed(l.patient_id,m.user_id) order by m.user_id limit 1;
 if caregiver is null then raise exception 'Active caregiver consent required'; end if;
 insert into public.support_tasks(patient_id,loop_id,caregiver_id,label) values(l.patient_id,p_loop,caregiver,i.label) on conflict(loop_id,caregiver_id) do update set status='open';
 update public.care_loops set next_owner='caregiver' where id=p_loop;
 elsif p_action='reopen' and r='clinician' and l.state='CLOSED' and length(trim(p_note))>0 then
 update public.care_loops set state=case when i.domain='medication' then 'UNCONFIRMED' else 'DUE' end,next_owner='patient',closed_at=null,review_note=null,reminded_at=null where id=p_loop;
 else raise exception 'Action not permitted for role or state' using errcode='42501'; end if;
 if p_action in ('complete','review') then update public.support_tasks set status='done' where loop_id=p_loop; end if;
 select to_jsonb(c) into result_value from public.care_loops c where id=p_loop;
 insert into public.audit_events(patient_id,loop_id,actor_id,actor_role,action,previous_state,next_state,note,event_key)
 values(l.patient_id,p_loop,auth.uid(),r,p_action,previous,result_value->>'state',left(trim(p_note),2000),p_event_key);
 update private.request_keys set result=result_value where actor_id=auth.uid() and event_key=p_event_key;
 return result_value;
end $$;
create function public.care_action(p_loop uuid,p_action text,p_event_key uuid,p_note text default '') returns jsonb
 language sql security invoker set search_path='' as $$ select private.act(p_loop,p_action,p_event_key,p_note); $$;

create function private.set_consent(p_patient uuid,p_caregiver uuid,p_granted boolean,p_event_key uuid) returns boolean
 language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 perform 1 from public.patients where id=p_patient for update;
 if private.patient_role(p_patient) is distinct from 'patient' then raise exception 'Only patient can change consent' using errcode='42501'; end if;
 if p_granted is null or p_event_key is null then raise exception 'Consent and event key required'; end if;
 if not exists(select 1 from private.memberships where patient_id=p_patient and user_id=p_caregiver and role='caregiver' and active) then raise exception 'Assigned caregiver required'; end if;
 insert into private.caregiver_consents(patient_id,caregiver_id,granted) values(p_patient,p_caregiver,p_granted) on conflict(patient_id,caregiver_id) do update set granted=excluded.granted,updated_at=now();
 if not p_granted then
 update public.care_loops set next_owner='patient' where id in(select loop_id from public.support_tasks where patient_id=p_patient and caregiver_id=p_caregiver and status='open') and next_owner='caregiver';
 update public.support_tasks set status='cancelled' where patient_id=p_patient and caregiver_id=p_caregiver and status='open';
 end if;
 insert into public.audit_events(patient_id,actor_id,actor_role,action,note,event_key) values(p_patient,auth.uid(),'patient','caregiver_consent',case when p_granted then 'Granted task support' else 'Revoked task support' end,p_event_key);
 return p_granted;
end $$;
create function public.set_caregiver_consent(p_patient uuid,p_caregiver uuid,p_granted boolean,p_event_key uuid) returns boolean
 language sql security invoker set search_path='' as $$select private.set_consent(p_patient,p_caregiver,p_granted,p_event_key);$$;

revoke all on all functions in schema private from public,anon;
grant execute on all functions in schema private to authenticated;
revoke all on function public.care_action(uuid,text,uuid,text) from public,anon;
revoke all on function public.set_caregiver_consent(uuid,uuid,boolean,uuid) from public,anon;
grant execute on function public.care_action(uuid,text,uuid,text),public.set_caregiver_consent(uuid,uuid,boolean,uuid) to authenticated;

-- Evidence is private. No uploads exposed until the verified-upload flow is implemented.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('care-evidence','care-evidence',false,10485760,array['application/pdf','image/jpeg','image/png']);
create policy wholecare_evidence_read on storage.objects for select to authenticated using(
 bucket_id='care-evidence' and exists(select 1 from public.evidence e where e.storage_path=name and private.patient_role(e.patient_id) is not null)
);

