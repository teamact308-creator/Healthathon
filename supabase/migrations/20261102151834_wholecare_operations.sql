-- Additive operations increment. Existing foundations must be present. No external dispatch is enabled.
begin;
create table public.intake_items(
 id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.patients,
 created_by uuid not null references auth.users, event_key uuid not null,
 label text not null check(length(label) between 1 and 200), source_text text not null default '' check(length(source_text)<=20000),
 source_path text, state text not null default 'unmatched' check(state in ('unmatched','matched','resolved','dismissed')),
 loop_id uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(loop_id,patient_id) references public.care_loops(id,patient_id), unique(created_by,event_key),unique(id,patient_id)
);
create index intake_patient_state on public.intake_items(patient_id,state,created_at);
create table public.intake_activity(
 id uuid primary key default gen_random_uuid(),patient_id uuid not null,intake_id uuid not null,
 actor_id uuid not null references auth.users,action text not null,reason text not null,
 created_at timestamptz not null default now(),foreign key(intake_id,patient_id) references public.intake_items(id,patient_id)
);
create index intake_activity_patient on public.intake_activity(patient_id,created_at);
create table public.processing_events(
 id uuid primary key default gen_random_uuid(),patient_id uuid not null references public.patients,
 actor_id uuid not null references auth.users,event_key uuid not null,
 operation text not null check(operation in ('upload','extraction','transcription','report','workspace','action','import')),
 code text not null check(code in ('timeout','network','rejected','unexpected')),resolved_at timestamptz,
 created_at timestamptz not null default now(),unique(actor_id,event_key)
);
create index processing_patient_created on public.processing_events(patient_id,created_at);
create table public.delivery_jobs(
 id uuid primary key default gen_random_uuid(),outbox_id uuid not null unique references public.message_outbox,
 patient_id uuid not null references public.patients, channel text not null check(channel in ('whatsapp','sms')),
 state text not null default 'blocked' check(state in ('blocked','pending','reserved','accepted','delivered','failed','unknown','cancelled')),
 attempts integer not null default 0 check(attempts between 0 and 3),provider_id text unique,
 version integer not null default 1,not_before timestamptz not null default now(),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index delivery_patient_state on public.delivery_jobs(patient_id,state);
alter table public.message_outbox add constraint outbox_patient_identity unique(id,patient_id);
alter table public.delivery_jobs add constraint delivery_outbox_patient foreign key(outbox_id,patient_id) references public.message_outbox(id,patient_id);
create table private.channel_enrollments(
 patient_id uuid not null references public.patients,channel text not null,
 recipient_reference text not null,consented boolean not null default false,verified_at timestamptz,
 primary key(patient_id,channel),check(channel in ('whatsapp','sms'))
);
alter table private.channel_enrollments enable row level security;
revoke all on private.channel_enrollments from public,anon,authenticated;
create table private.delivery_receipts(event_key text primary key,job_id uuid not null references public.delivery_jobs,created_at timestamptz not null default now());
alter table private.delivery_receipts enable row level security;
revoke all on private.delivery_receipts from public,anon,authenticated;
-- No destinations, consent enrollments or enabled gate are provisioned by this release.
create table private.channel_gates(channel text primary key check(channel in ('whatsapp','sms')),enabled boolean not null default false);
insert into private.channel_gates(channel) values('whatsapp'),('sms');
alter table private.channel_gates enable row level security;
revoke all on private.channel_gates from public,anon,authenticated;
do $$declare t text;begin
 foreach t in array array['intake_items','intake_activity','processing_events','delivery_jobs'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;
end$$;
create policy intake_read on public.intake_items for select to authenticated using(private.patient_role(patient_id) is not null);
create policy intake_history_read on public.intake_activity for select to authenticated using(private.patient_role(patient_id) is not null);
create policy failures_team_read on public.processing_events for select to authenticated using(private.patient_role(patient_id) in ('clinician','coordinator'));
create policy delivery_team_read on public.delivery_jobs for select to authenticated using(private.patient_role(patient_id) in ('clinician','coordinator'));
create policy intake_file_read on storage.objects for select to authenticated using(bucket_id='care-evidence' and exists(select 1 from public.intake_items i where i.source_path=name and private.patient_role(i.patient_id) is not null));

create function private.submit_intake(p_patient uuid,p_label text,p_text text,p_path text,p_event uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;old public.intake_items;begin
 if auth.uid() is null or private.patient_role(p_patient) is distinct from 'patient' then raise exception 'Assigned patient required' using errcode='42501';end if;
 if p_event is null or length(trim(p_label)) not between 1 and 200 or length(coalesce(p_text,''))>20000 or (nullif(trim(p_text),'') is null and p_path is null) then raise exception 'Label and a note or file are required';end if;
 if p_path is not null and (split_part(p_path,'/',1)<>p_patient::text or not exists(select 1 from storage.objects where bucket_id='care-evidence' and name=p_path)) then raise exception 'Private source not accessible' using errcode='42501';end if;
 insert into public.intake_items(patient_id,created_by,event_key,label,source_text,source_path) values(p_patient,auth.uid(),p_event,trim(p_label),coalesce(p_text,''),p_path) on conflict do nothing returning id into result;
 if result is null then
 select * into old from public.intake_items where created_by=auth.uid() and event_key=p_event;
 if old.patient_id is distinct from p_patient or old.label is distinct from trim(p_label) or old.source_text is distinct from coalesce(p_text,'') or old.source_path is distinct from p_path then raise exception 'Request key reused with different input';end if;return old.id;
 end if;
 insert into public.intake_activity(patient_id,intake_id,actor_id,action,reason) values(p_patient,result,auth.uid(),'submitted','Awaiting human association; no care task changed');return result;
end$$;
create function public.submit_intake(p_patient uuid,p_label text,p_text text,p_path text,p_event uuid) returns uuid language sql security invoker set search_path='' as $$select private.submit_intake(p_patient,p_label,p_text,p_path,p_event);$$;

create function private.resolve_intake(p_intake uuid,p_action text,p_loop uuid,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.intake_items;r text;new_state text;begin
 select * into i from public.intake_items where id=p_intake for update;r:=private.patient_role(i.patient_id);
 if auth.uid() is null or r is null then raise exception 'Intake not accessible' using errcode='42501';end if;
 if length(trim(coalesce(p_reason,''))) not between 1 and 2000 then raise exception 'Reason required';end if;
 if i.state in ('resolved','dismissed') then raise exception 'Intake already resolved';end if;
 if p_action='match' and r in ('clinician','coordinator') then
 if i.source_path is null or not exists(select 1 from public.care_loops l join public.care_plan_items a on a.id=l.item_id join public.care_plans p on p.id=a.plan_id where l.id=p_loop and l.patient_id=i.patient_id and a.domain='test' and l.state='DUE' and l.due_at<=now() and p.active and p.status='confirmed') then raise exception 'Choose a due active investigation for this patient and a file intake';end if;
 new_state:='matched';
 elsif p_action='dismiss' and r in ('clinician','coordinator') then new_state:='dismissed';
 elsif p_action='acknowledge' and r in ('clinician','coordinator') and i.source_path is null then new_state:='resolved';
 elsif p_action='finish' and r='patient' and i.state='matched' and exists(select 1 from public.evidence e where e.loop_id=i.loop_id and e.patient_id=i.patient_id and e.storage_path=i.source_path and not e.is_fixture) then new_state:='resolved';
 else raise exception 'Action not permitted' using errcode='42501';end if;
 update public.intake_items set state=new_state,loop_id=case when p_action='match' then p_loop else loop_id end,updated_at=now() where id=p_intake returning * into i;
 insert into public.intake_activity(patient_id,intake_id,actor_id,action,reason) values(i.patient_id,i.id,auth.uid(),p_action,trim(p_reason));return to_jsonb(i);
end$$;
create function public.resolve_intake(p_intake uuid,p_action text,p_loop uuid,p_reason text) returns jsonb language sql security invoker set search_path='' as $$select private.resolve_intake(p_intake,p_action,p_loop,p_reason);$$;

create function private.record_failure(p_patient uuid,p_operation text,p_code text,p_event uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null or private.patient_role(p_patient) is null then raise exception 'Assigned user required' using errcode='42501';end if;
 if (select count(*) from public.processing_events where actor_id=auth.uid() and created_at>now()-interval '1 day')>=100 then return;end if;
 insert into public.processing_events(patient_id,actor_id,event_key,operation,code) values(p_patient,auth.uid(),p_event,p_operation,p_code) on conflict do nothing;
end$$;
create function public.record_processing_failure(p_patient uuid,p_operation text,p_code text,p_event uuid) returns void language sql security invoker set search_path='' as $$select private.record_failure(p_patient,p_operation,p_code,p_event);$$;
create function private.resolve_failure(p_id uuid) returns void language plpgsql security definer set search_path='' as $$declare p uuid;begin
 select patient_id into p from public.processing_events where id=p_id;
 if auth.uid() is null or private.patient_role(p) not in ('clinician','coordinator') or private.patient_role(p) is null then raise exception 'Care team required' using errcode='42501';end if;
 update public.processing_events set resolved_at=coalesce(resolved_at,now()) where id=p_id;
end$$;
create function public.resolve_processing_failure(p_id uuid) returns void language sql security invoker set search_path='' as $$select private.resolve_failure(p_id);$$;

create function private.operational_snapshot(p_patient uuid,p_from timestamptz,p_to timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$declare result jsonb;begin
 if auth.uid() is null or private.patient_role(p_patient) is null or private.patient_role(p_patient) not in ('clinician','coordinator') then raise exception 'Assigned care team required' using errcode='42501';end if;
 if p_from is null or p_to is null or p_to<=p_from or p_to-p_from>interval '91 days' or p_to>now()+interval '2 days' then raise exception 'Choose a valid period of up to 90 days';end if;
 select jsonb_build_object('from',p_from,'to',p_to,'generated_at',now(),
 'plans',(select coalesce(jsonb_agg(x),'[]') from public.care_plans x where patient_id=p_patient),
 'items',(select coalesce(jsonb_agg(x),'[]') from public.care_plan_items x where patient_id=p_patient),
 'loops',(select coalesce(jsonb_agg(x),'[]') from public.care_loops x where patient_id=p_patient and ((due_at>=p_from and due_at<p_to) or (due_at<p_to and state not in ('CLOSED','CANCELLED')))),
 'events',(select coalesce(jsonb_agg(x),'[]') from public.care_events x where patient_id=p_patient and coalesce((details->>'recorded_at')::timestamptz,occurred_at)>=p_from and coalesce((details->>'recorded_at')::timestamptz,occurred_at)<p_to),
 'audit',(select coalesce(jsonb_agg(x),'[]') from public.audit_events x where patient_id=p_patient and created_at>=p_from and created_at<p_to),
 'planActivity',(select coalesce(jsonb_agg(x),'[]') from public.plan_activity x where patient_id=p_patient and created_at>=p_from and created_at<p_to),
 'evidence',(select coalesce(jsonb_agg(x),'[]') from public.evidence x where patient_id=p_patient),
 'observations',(select coalesce(jsonb_agg(x),'[]') from (select observed_at,value,unit from public.glucose_observations where patient_id=p_patient and observed_at<p_to order by observed_at desc limit 1) x),
 'failures',(select coalesce(jsonb_agg(x),'[]') from public.processing_events x where patient_id=p_patient and created_at>=p_from and created_at<p_to),
 'intake',(select coalesce(jsonb_agg(x),'[]') from public.intake_items x where patient_id=p_patient and state in ('unmatched','matched')),
 'delivery',(select coalesce(jsonb_agg(x),'[]') from public.delivery_jobs x where patient_id=p_patient)) into result;
 return result;
end$$;
create function public.operational_snapshot(p_patient uuid,p_from timestamptz,p_to timestamptz) returns jsonb language sql security invoker set search_path='' as $$select private.operational_snapshot(p_patient,p_from,p_to);$$;
-- Service-only transport building blocks. No worker is scheduled and both gates stay false.
create function private.prepare_delivery(p_outbox uuid,p_channel text) returns uuid language plpgsql security definer set search_path='' as $$declare j uuid;begin
 insert into public.delivery_jobs(outbox_id,patient_id,channel) select id,patient_id,p_channel from public.message_outbox where id=p_outbox and delivery_status='pending' on conflict(outbox_id) do nothing returning id into j;
 if j is null then select id into j from public.delivery_jobs where outbox_id=p_outbox and channel=p_channel;end if;return j;
end$$;
create function private.claim_delivery(p_job uuid,p_version integer) returns jsonb language plpgsql security definer set search_path='' as $$declare j public.delivery_jobs;begin
 select * into j from public.delivery_jobs where id=p_job for update skip locked;
 if not found or j.version<>p_version or j.state<>'pending' or j.attempts>=3 or j.provider_id is not null or j.not_before>now() then return null;end if;
 perform 1 from public.patients where id=j.patient_id for update;
 if not exists(select 1 from private.channel_gates where channel=j.channel and enabled) or not exists(select 1 from private.channel_enrollments where patient_id=j.patient_id and channel=j.channel and consented and verified_at is not null) then return null;end if;
 if not exists(select 1 from public.message_outbox m join public.care_loops l on l.id=m.loop_id where m.id=j.outbox_id and m.delivery_status='pending' and l.state in ('DUE','UNCONFIRMED')) then
 update public.delivery_jobs set state='cancelled',updated_at=now(),version=version+1 where id=j.id;return null;end if;
 update public.delivery_jobs set state='reserved',attempts=attempts+1,version=version+1,updated_at=now() where id=j.id returning * into j;return to_jsonb(j);
end$$;
create function private.delivery_result(p_job uuid,p_key text,p_status text,p_provider text) returns void language plpgsql security definer set search_path='' as $$declare j public.delivery_jobs;begin
 if p_status not in ('accepted','delivered','failed','unknown') or length(coalesce(p_key,'')) not between 1 and 200 then raise exception 'Invalid delivery receipt';end if;
 select * into j from public.delivery_jobs where id=p_job for update;if not found then raise exception 'Delivery job missing';end if;
 if j.state in ('blocked','pending') then raise exception 'Delivery has not been reserved';end if;
 if j.provider_id is not null and p_provider is distinct from j.provider_id then raise exception 'Provider identity mismatch';end if;
 insert into private.delivery_receipts(event_key,job_id) values(p_key,p_job) on conflict do nothing;
 if not found then if not exists(select 1 from private.delivery_receipts where event_key=p_key and job_id=p_job) then raise exception 'Receipt key mismatch';end if;return;end if;
 if j.state in ('delivered','cancelled') or (p_status='accepted' and j.state in ('failed','unknown')) then return;end if;
 update public.delivery_jobs set state=p_status,provider_id=coalesce(provider_id,p_provider),version=version+1,updated_at=now() where id=p_job;
 if p_status='delivered' then update public.message_outbox set delivery_status='sent' where id=j.outbox_id;
 elsif p_status in ('failed','unknown') then update public.message_outbox set delivery_status='failed' where id=j.outbox_id;end if;
end$$;
revoke all on function private.prepare_delivery(uuid,text),private.claim_delivery(uuid,integer),private.delivery_result(uuid,text,text,text) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.prepare_delivery(uuid,text),private.claim_delivery(uuid,integer),private.delivery_result(uuid,text,text,text) to service_role;
-- Explicit function grants: no public/anonymous execution and no broad private grants.
do $$declare f record;begin
 for f in select p.oid::regprocedure signature,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','public') and p.proname in ('submit_intake','resolve_intake','record_failure','record_processing_failure','resolve_failure','resolve_processing_failure','operational_snapshot') loop
 execute format('revoke all on function %s from public,anon',f.signature);
 execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end$$;
commit;
