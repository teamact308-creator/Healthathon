-- Reconciled connected baseline; already applied in development. No seed/auth data.
-- Technical handshake receipts only: no phone numbers, message bodies or patient linkage.
create table public.whatsapp_webhook_receipts (
 message_sid text primary key check(message_sid ~ '^SM[0-9a-fA-F]{32}$'),
 received_at timestamptz not null default now(),
 kind text not null check(kind in ('hello','other'))
);
alter table public.whatsapp_webhook_receipts enable row level security;
revoke all on public.whatsapp_webhook_receipts from public, anon, authenticated;
grant select, insert on public.whatsapp_webhook_receipts to service_role;

create table public.twilio_test_sends (
 test_key text primary key check(test_key='whatsapp_trial_v1'),
 actor_id uuid not null references auth.users,
 state text not null check(state in ('reserved','submitted','rejected','unknown')),
 message_sid text, provider_status text, error_code integer,
 created_at timestamptz not null default now()
);
alter table public.twilio_test_sends enable row level security;
revoke all on public.twilio_test_sends from public,anon,authenticated;
grant select,insert,update on public.twilio_test_sends to service_role;

-- Apply ONCE after the existing WholeCare foundation/context migrations.
-- Already applied to wholecare-diabetes-dev; do not re-run there.
begin;
alter table public.care_plans add column active boolean not null default true,
 add column source_path text, add column extraction_id uuid,
 add column timezone text not null default 'Asia/Kolkata',
 add column reminder_minutes integer not null default 30 check(reminder_minutes between 5 and 1440),
 add column quiet_start integer not null default 20 check(quiet_start between 0 and 23),
 add column quiet_end integer not null default 9 check(quiet_end between 0 and 23);
alter table public.care_plan_items add column source_excerpt text not null default '';
alter table public.care_loops drop constraint care_loops_state_check, drop constraint care_loops_check1;
alter table public.care_loops add constraint care_loops_state_check check(state in ('DUE','UNCONFIRMED','REVIEW_PENDING','CLOSED','CANCELLED')),
 add constraint care_loops_owner_state_check check((state in ('CLOSED','CANCELLED'))=(next_owner='none'));
alter table public.patients add column reminders_enabled boolean not null default true;
create unique index one_active_confirmed_plan on public.care_plans(patient_id) where status='confirmed' and active;
create table public.plan_extractions (
 id uuid primary key, patient_id uuid not null references public.patients,
 actor_id uuid not null references auth.users, source_path text, source_text text not null default '', model text not null,
 proposal jsonb not null, created_at timestamptz not null default now()
);
alter table public.care_plans add foreign key(extraction_id) references public.plan_extractions;
create table public.plan_schedules (
 item_id uuid primary key references public.care_plan_items on delete cascade,
 patient_id uuid not null references public.patients,
 start_date date not null, end_date date not null, times time[] not null,
 check(end_date>=start_date and end_date<=start_date+365),check(cardinality(times) between 1 and 4)
);
create table public.plan_activity (
 id uuid primary key default gen_random_uuid(), plan_id uuid not null references public.care_plans,
 patient_id uuid not null references public.patients, actor_id uuid references auth.users,
 action text not null,note text not null default '',created_at timestamptz not null default now()
);
do $$declare t text;begin
 foreach t in array array['plan_extractions','plan_schedules','plan_activity'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 execute format('create policy assigned_read on public.%I for select to authenticated using(private.patient_role(patient_id) is not null)',t);
 end loop;
end$$;
-- Draft/save is clinician-only. Client-selected UUID makes retrying a save update the same draft.
create function private.save_plan(p_patient uuid,p_plan uuid,p_data jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare v jsonb; i uuid; ts time[]; d date; e date; existing public.care_plans; tz text; path text; extraction uuid;
begin
 if auth.uid() is null or private.patient_role(p_patient) is distinct from 'clinician' then raise exception 'Assigned clinician required' using errcode='42501';end if;
 perform 1 from public.patients where id=p_patient for update;
 select * into existing from public.care_plans where id=p_plan for update;
 if found and (existing.patient_id<>p_patient or existing.status<>'proposed') then raise exception 'Only your proposed plan can be edited' using errcode='42501';end if;
 if p_plan is null or length(trim(p_data->>'source_note')) not between 1 and 20000 or jsonb_typeof(p_data->'items')<>'array' or jsonb_array_length(p_data->'items') not between 1 and 20 then raise exception 'Source note and 1 to 20 items required';end if;
 tz:=p_data->>'timezone';
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=tz) then raise exception 'Valid timezone required';end if;
 path:=nullif(p_data->>'source_path','');extraction:=nullif(p_data->>'extraction_id','')::uuid;
 if path is not null and (split_part(path,'/',1)<>p_patient::text or not exists(select 1 from storage.objects where bucket_id='plan-documents' and name=path)) then raise exception 'Source file must belong to this patient';end if;
 if extraction is not null and not exists(select 1 from public.plan_extractions where id=extraction and patient_id=p_patient and source_path is not distinct from path) then raise exception 'Extraction source mismatch';end if;
 insert into public.care_plans(id,patient_id,source_note,status,active,source_path,extraction_id,timezone)
 values(p_plan,p_patient,trim(p_data->>'source_note'),'proposed',false,path,extraction,tz)
 on conflict(id) do update set source_note=excluded.source_note,source_path=excluded.source_path,extraction_id=excluded.extraction_id,timezone=excluded.timezone;
 delete from public.care_plan_items where plan_id=p_plan;
 for v in select value from jsonb_array_elements(p_data->'items') loop
 if v->>'domain' not in ('medication','meals','glucose','test') or length(trim(v->>'label')) not between 1 and 300 or v->>'cadence' not in ('once','daily') then raise exception 'Valid domain, label and cadence required';end if;
 d:=(v->>'start_date')::date;e:=(v->>'end_date')::date;
 if d is null or e is null or e<d or e>d+365 or d<(now() at time zone tz)::date-1 then raise exception 'Schedule must start no earlier than yesterday and last at most one year';end if;
 select array_agg(distinct value::time order by value::time) into ts from jsonb_array_elements_text(v->'times');
 if ts is null or cardinality(ts) not between 1 and 4 or exists(select 1 from unnest(ts) t where t>=time '24:00') then raise exception 'Choose 1 to 4 distinct daily times';end if;
 if v->>'cadence'='once' and (d<>e or cardinality(ts)<>1) then raise exception 'One-off task requires one date and time';end if;
 insert into public.care_plan_items(plan_id,patient_id,domain,label,cadence,requires_human_review,source_excerpt)
 values(p_plan,p_patient,v->>'domain',trim(v->>'label'),v->>'cadence',v->>'domain'='test',left(coalesce(v->>'source_excerpt',''),2000)) returning id into i;
 insert into public.plan_schedules(item_id,patient_id,start_date,end_date,times) values(i,p_patient,d,e,ts);
 end loop;
 insert into public.plan_activity(plan_id,patient_id,actor_id,action) values(p_plan,p_patient,auth.uid(),'draft_saved');
 return p_plan;
end$$;
create function private.generate_plan(p_plan uuid) returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 insert into public.care_loops(item_id,patient_id,due_at)
 select i.id,i.patient_id,(day::date+t) at time zone p.timezone
 from public.care_plans p join public.care_plan_items i on i.plan_id=p.id
 join public.plan_schedules s on s.item_id=i.id
 cross join lateral generate_series(s.start_date::timestamp,least(s.end_date,(now() at time zone p.timezone)::date+14)::timestamp,interval '1 day') day
 cross join lateral unnest(s.times) t
 where p.id=p_plan and p.status='confirmed' and p.active
 and (i.cadence='daily' or day::date=s.start_date)
 on conflict do nothing;
 get diagnostics n=row_count;return n;
end$$;
create function private.review_plan(p_plan uuid,p_action text,p_note text) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.care_plans;n integer;
begin
 select * into p from public.care_plans where id=p_plan;
 if auth.uid() is null or private.patient_role(p.patient_id) is distinct from 'clinician' then raise exception 'Assigned clinician required' using errcode='42501';end if;
 perform 1 from public.patients where id=p.patient_id for update;
 select * into p from public.care_plans where id=p_plan for update;
 if p_action='confirm' and p.status='confirmed' then return jsonb_build_object('id',p_plan,'already_confirmed',true);end if;
 if p.status<>'proposed' or p_action not in ('confirm','reject') or length(trim(p_note)) not between 1 and 2000 then raise exception 'Proposed plan and review note required';end if;
 if p_action='confirm' then
 if not exists(select 1 from public.plan_schedules s join public.care_plan_items i on i.id=s.item_id where i.plan_id=p_plan) then raise exception 'Schedule required';end if;
 -- Preserve completed history and review-pending evidence; retire other outstanding old tasks.
 update public.care_loops l set state='CANCELLED',next_owner='none' where l.patient_id=p.patient_id and l.state in ('DUE','UNCONFIRMED') and exists(select 1 from public.care_plan_items i join public.care_plans old on old.id=i.plan_id where i.id=l.item_id and old.active and old.status='confirmed');
 update public.support_tasks set status='cancelled' where patient_id=p.patient_id and status='open' and loop_id in(select id from public.care_loops where state='CANCELLED');
 update public.message_outbox set delivery_status='failed' where patient_id=p.patient_id and delivery_status='pending' and loop_id in(select id from public.care_loops where state='CANCELLED');
 update public.care_plans set active=false where patient_id=p.patient_id and status='confirmed' and active;
 update public.care_plans set active=true,status='confirmed',confirmed_by=auth.uid(),confirmed_at=now() where id=p_plan;
 n:=private.generate_plan(p_plan);
 else update public.care_plans set active=false,status='cancelled' where id=p_plan;n:=0;
 end if;
 insert into public.plan_activity(plan_id,patient_id,actor_id,action,note) values(p_plan,p.patient_id,auth.uid(),p_action,trim(p_note));
 return jsonb_build_object('id',p_plan,'occurrences_created',n);
end$$;
create function private.plan_scheduler() returns jsonb language plpgsql security definer set search_path='' as $$
declare vplan record;l record;n integer:=0;r integer:=0;
begin
 if not pg_try_advisory_xact_lock(3082026) then return jsonb_build_object('busy',true);end if;
 for vplan in select id,patient_id from public.care_plans where status='confirmed' and active order by patient_id loop
 perform 1 from public.patients where id=vplan.patient_id for update;
 n:=n+private.generate_plan(vplan.id);
 end loop;
 for l in select c.id,c.patient_id,i.label,p.id as plan_id from public.care_loops c join public.care_plan_items i on i.id=c.item_id join public.care_plans p on p.id=i.plan_id join public.patients patient on patient.id=c.patient_id
 where p.active and p.status='confirmed' and patient.reminders_enabled and c.state in ('DUE','UNCONFIRMED') and c.reminded_at is null and c.due_at<=now()-make_interval(mins=>p.reminder_minutes)
 and (case when p.quiet_start>p.quiet_end then extract(hour from now() at time zone p.timezone)>=p.quiet_end and extract(hour from now() at time zone p.timezone)<p.quiet_start else extract(hour from now() at time zone p.timezone)<p.quiet_start or extract(hour from now() at time zone p.timezone)>=p.quiet_end end)
 for update of c skip locked loop
 insert into public.message_outbox(patient_id,loop_id,recipient_role,body,delivery_status) values(l.patient_id,l.id,'patient','Reminder: '||l.label||'. Please confirm or ask for support.','pending');
 update public.care_loops set reminded_at=now() where id=l.id;
 insert into public.plan_activity(plan_id,patient_id,action,note) values(l.plan_id,l.patient_id,'reminder_queued','In-app outbox only; no WhatsApp send');r:=r+1;
 end loop;
 return jsonb_build_object('generated',n,'reminders_queued',r);
end$$;
create function private.reminder_preference(p_patient uuid,p_enabled boolean) returns boolean language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null or private.patient_role(p_patient) is distinct from 'patient' or p_enabled is null then raise exception 'Assigned patient required' using errcode='42501';end if;
 perform 1 from public.patients where id=p_patient for update;
 update public.patients set reminders_enabled=p_enabled where id=p_patient;return p_enabled;end$$;
create function public.save_care_plan(p_patient uuid,p_plan uuid,p_data jsonb) returns uuid language sql security invoker set search_path='' as $$select private.save_plan(p_patient,p_plan,p_data);$$;
create function public.review_care_plan(p_plan uuid,p_action text,p_note text) returns jsonb language sql security invoker set search_path='' as $$select private.review_plan(p_plan,p_action,p_note);$$;
create function public.set_reminder_preference(p_patient uuid,p_enabled boolean) returns boolean language sql security invoker set search_path='' as $$select private.reminder_preference(p_patient,p_enabled);$$;
revoke all on function private.save_plan(uuid,uuid,jsonb),private.review_plan(uuid,text,text),private.reminder_preference(uuid,boolean),public.save_care_plan(uuid,uuid,jsonb),public.review_care_plan(uuid,text,text),public.set_reminder_preference(uuid,boolean) from public,anon;
grant execute on function private.save_plan(uuid,uuid,jsonb),private.review_plan(uuid,text,text),private.reminder_preference(uuid,boolean),public.save_care_plan(uuid,uuid,jsonb),public.review_care_plan(uuid,text,text),public.set_reminder_preference(uuid,boolean) to authenticated;
revoke all on function private.generate_plan(uuid),private.plan_scheduler() from public,anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('plan-documents','plan-documents',false,8388608,array['application/pdf','image/jpeg','image/png']);
create policy plan_document_upload on storage.objects for insert to authenticated with check(bucket_id='plan-documents' and private.patient_role((storage.foldername(name))[1]::uuid)='clinician');
create policy plan_document_read on storage.objects for select to authenticated using(bucket_id='plan-documents' and private.patient_role((storage.foldername(name))[1]::uuid) is not null);
commit;

alter table public.evidence add column content_sha256 text check(content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$');
create unique index evidence_patient_content on public.evidence(patient_id,content_sha256);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('voice-notes','voice-notes',false,8388608,array['audio/webm','audio/mpeg','audio/wav','audio/mp4']),('meal-photos','meal-photos',false,8388608,array['image/jpeg','image/png']);
create policy voice_upload on storage.objects for insert to authenticated with check(bucket_id='voice-notes' and private.patient_role((storage.foldername(name))[1]::uuid) in ('patient','clinician'));
create policy voice_read on storage.objects for select to authenticated using(bucket_id='voice-notes' and private.patient_role((storage.foldername(name))[1]::uuid) is not null);
create policy meal_upload on storage.objects for insert to authenticated with check(bucket_id='meal-photos' and private.patient_role((storage.foldername(name))[1]::uuid)='patient');
create policy meal_read on storage.objects for select to authenticated using(bucket_id='meal-photos' and private.patient_role((storage.foldername(name))[1]::uuid) is not null);

begin;
grant usage on schema private to service_role;
create function private.log_activity(p_loop uuid,p_status text,p_details jsonb,p_event uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare l public.care_loops;i public.care_plan_items;v_result jsonb;old private.request_keys;done boolean;prev text;actual_time timestamptz;
begin
 if auth.uid() is null or p_event is null then raise exception 'Authentication required' using errcode='42501';end if;
 insert into private.request_keys(actor_id,event_key,loop_id,action) values(auth.uid(),p_event,p_loop,'log:'||p_status) on conflict do nothing;
 if not found then select * into old from private.request_keys where actor_id=auth.uid() and event_key=p_event;if old.loop_id is distinct from p_loop or old.action<>'log:'||p_status then raise exception 'Request key mismatch';end if;return old.result;end if;
 select * into l from public.care_loops where id=p_loop for update;
 if private.patient_role(l.patient_id) is distinct from 'patient' then raise exception 'Assigned patient required' using errcode='42501';end if;
 select * into i from public.care_plan_items where id=l.item_id;
 if l.state not in ('DUE','UNCONFIRMED') or l.due_at>now() or not exists(select 1 from public.care_plans where id=i.plan_id and status='confirmed' and active) then raise exception 'Active due task required';end if;
 if jsonb_typeof(p_details)<>'object' or length(p_details::text)>5000 or length(trim(p_details->>'note')) not between 1 and 2000 then raise exception 'Activity description required';end if;
 if not ((i.domain='medication' and p_status in ('taken','missed','delayed','skipped_by_instruction')) or (i.domain='meals' and p_status='meal_logged') or (i.domain='glucose' and p_status='availability_confirmed')) then raise exception 'Status does not match this task';end if;
 if i.domain='glucose' and not exists(select 1 from public.glucose_observations where patient_id=l.patient_id and observed_at between l.due_at-interval '24 hours' and now()) then raise exception 'Import recent monitoring data first';end if;
 if nullif(p_details->>'photo_path','') is not null and (i.domain<>'meals' or split_part(p_details->>'photo_path','/',1)<>l.patient_id::text or not exists(select 1 from storage.objects where bucket_id='meal-photos' and name=p_details->>'photo_path')) then raise exception 'Meal photo source mismatch';end if;
 if nullif(p_details->>'audio_path','') is not null and (split_part(p_details->>'audio_path','/',1)<>l.patient_id::text or not exists(select 1 from storage.objects where bucket_id='voice-notes' and name=p_details->>'audio_path')) then raise exception 'Voice source mismatch';end if;
 actual_time:=coalesce(nullif(p_details->>'activity_at','')::timestamptz,now());
 if actual_time>now()+interval '5 minutes' or actual_time<now()-interval '30 days' then raise exception 'Activity time must be within the past 30 days, not in the future';end if;
 done:=p_status in ('taken','meal_logged','availability_confirmed');prev:=l.state;
 update public.care_loops set state=case when done then 'CLOSED' else 'UNCONFIRMED' end,next_owner=case when done then 'none' else 'patient' end,closed_at=case when done then now() else null end where id=p_loop;
 insert into public.care_events(patient_id,loop_id,actor_id,domain,status,details,occurred_at) values(l.patient_id,p_loop,auth.uid(),i.domain,p_status,jsonb_build_object('note',trim(p_details->>'note'),'source',case when p_details->>'source'='voice' then 'voice_confirmed' else 'web' end,'synthetic',true,'recorded_at',now(),'photo_path',p_details->>'photo_path','audio_path',p_details->>'audio_path','activity_at',actual_time),actual_time);
 if done then update public.support_tasks set status='done' where loop_id=p_loop;end if;
 select to_jsonb(c) into v_result from public.care_loops c where id=p_loop;
 insert into public.audit_events(patient_id,loop_id,actor_id,actor_role,action,previous_state,next_state,note,event_key) values(l.patient_id,p_loop,auth.uid(),'patient',p_status,prev,v_result->>'state',trim(p_details->>'note'),p_event);
 update private.request_keys k set result=v_result where k.actor_id=auth.uid() and k.event_key=p_event;
 return v_result;
end$$;
create function public.log_care_activity(p_loop uuid,p_status text,p_details jsonb,p_event uuid) returns jsonb language sql security invoker set search_path='' as $$select private.log_activity(p_loop,p_status,p_details,p_event);$$;
create function private.register_report(p_actor uuid,p_loop uuid,p_path text,p_hash text,p_label text,p_event uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare l public.care_loops;i public.care_plan_items;v_result jsonb;old private.request_keys;ev uuid;
begin
 if (auth.jwt()->>'role') is distinct from 'service_role' then raise exception 'Backend only' using errcode='42501';end if;
 insert into private.request_keys(actor_id,event_key,loop_id,action) values(p_actor,p_event,p_loop,'verified_report') on conflict do nothing;
 if not found then select * into old from private.request_keys where actor_id=p_actor and event_key=p_event;if old.loop_id is distinct from p_loop or old.action<>'verified_report' then raise exception 'Request mismatch';end if;return old.result;end if;
 select * into l from public.care_loops where id=p_loop for update;
 if not exists(select 1 from public.patients where id=l.patient_id and user_id=p_actor) then raise exception 'Assigned patient required';end if;
 select * into i from public.care_plan_items where id=l.item_id;
 if i.domain<>'test' or l.state<>'DUE' or l.due_at>now() or not exists(select 1 from public.care_plans where id=i.plan_id and status='confirmed' and active) then raise exception 'Active due test required';end if;
 if split_part(p_path,'/',1)<>l.patient_id::text or not exists(select 1 from storage.objects where bucket_id='care-evidence' and name=p_path) then raise exception 'Report source mismatch';end if;
 if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then raise exception 'Verified hash required';end if;
 if exists(select 1 from public.evidence where patient_id=l.patient_id and content_sha256=p_hash) then raise exception 'Duplicate report content';end if;
 if exists(select 1 from public.evidence where storage_path=p_path) then raise exception 'Report already attached';end if;
 insert into public.evidence(patient_id,loop_id,submitted_by,label,storage_path,is_fixture,content_sha256) values(l.patient_id,p_loop,p_actor,left(p_label,200),p_path,false,p_hash) returning id into ev;
 update public.care_loops set state='REVIEW_PENDING',next_owner='clinician' where id=p_loop;
 v_result:=jsonb_build_object('evidence_id',ev,'state','REVIEW_PENDING');
 insert into public.audit_events(patient_id,loop_id,actor_id,actor_role,action,previous_state,next_state,note,event_key) values(l.patient_id,p_loop,p_actor,'patient','verified_report','DUE','REVIEW_PENDING','Private file signature validated; clinician review required',p_event);
 update private.request_keys k set result=v_result where k.actor_id=p_actor and k.event_key=p_event;return v_result;
end$$;
create function public.register_verified_report(p_actor uuid,p_loop uuid,p_path text,p_hash text,p_label text,p_event uuid) returns jsonb language sql security invoker set search_path='' as $$select private.register_report(p_actor,p_loop,p_path,p_hash,p_label,p_event);$$;
create policy report_upload on storage.objects for insert to authenticated with check(bucket_id='care-evidence' and private.patient_role((storage.foldername(name))[1]::uuid)='patient');
-- Read policy already checks the patient/evidence relationship.
create function private.import_glucose(p_patient uuid,p_rows jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;n integer:=0;d integer:=0;t timestamptz;val numeric;begin
 if auth.uid() is null or coalesce(private.patient_role(p_patient),'') not in ('patient','clinician') then raise exception 'Assigned patient or clinician required' using errcode='42501';end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 2000 then raise exception '1 to 2000 synthetic readings required';end if;
 for v in select value from jsonb_array_elements(p_rows) loop
 t:=(v->>'observed_at')::timestamptz;val:=(v->>'value')::numeric;
 if t is null or t>now()+interval '1 day' or val is null or val<=0 or val>1000000 or v->>'unit' is distinct from 'mg/dL' or length(v->>'source_id') not between 1 and 100 then raise exception 'Invalid timestamp, value, unit or source';end if;
 insert into public.glucose_observations(patient_id,observed_at,value,unit,source_id,synthetic) values(p_patient,t,val,'mg/dL',v->>'source_id',true) on conflict(patient_id,source_id,observed_at) do nothing;
 if found then n:=n+1;else d:=d+1;end if;
 end loop;return jsonb_build_object('inserted',n,'duplicates',d);end$$;
create function public.import_synthetic_glucose(p_patient uuid,p_rows jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.import_glucose(p_patient,p_rows);$$;
revoke all on function private.log_activity(uuid,text,jsonb,uuid),public.log_care_activity(uuid,text,jsonb,uuid),private.import_glucose(uuid,jsonb),public.import_synthetic_glucose(uuid,jsonb) from public,anon;
grant execute on function private.log_activity(uuid,text,jsonb,uuid),public.log_care_activity(uuid,text,jsonb,uuid),private.import_glucose(uuid,jsonb),public.import_synthetic_glucose(uuid,jsonb) to authenticated;
revoke all on function private.register_report(uuid,uuid,text,text,text,uuid),public.register_verified_report(uuid,uuid,text,text,text,uuid) from public,anon,authenticated;
grant execute on function private.register_report(uuid,uuid,text,text,text,uuid),public.register_verified_report(uuid,uuid,text,text,text,uuid) to service_role;
commit;

begin;
alter table public.care_loops add column scheduled_for timestamptz;
update public.care_loops set scheduled_for=due_at;
alter table public.care_loops alter column scheduled_for set not null;
create unique index occurrence_original_time on public.care_loops(item_id,scheduled_for);
create function private.set_original_due() returns trigger language plpgsql set search_path='' as $$begin new.scheduled_for:=coalesce(new.scheduled_for,new.due_at);return new;end$$;
create trigger set_original_due before insert on public.care_loops for each row execute function private.set_original_due();
revoke all on function private.set_original_due() from public,anon,authenticated;
create function private.manage_loop(p_loop uuid,p_action text,p_due timestamptz,p_note text,p_event uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare l public.care_loops;r text;outcome jsonb;old private.request_keys;begin
 if auth.uid() is null or p_event is null then raise exception 'Authentication required' using errcode='42501';end if;
 insert into private.request_keys(actor_id,event_key,loop_id,action) values(auth.uid(),p_event,p_loop,'manage:'||p_action) on conflict do nothing;
 if not found then select * into old from private.request_keys where actor_id=auth.uid() and event_key=p_event;if old.loop_id is distinct from p_loop or old.action<>'manage:'||p_action then raise exception 'Request mismatch';end if;return old.result;end if;
 select * into l from public.care_loops where id=p_loop for update;r:=private.patient_role(l.patient_id);
 if coalesce(r,'') not in ('clinician','coordinator') or p_action not in ('snooze','cancel') or length(trim(p_note)) not between 1 and 2000 or l.state not in ('DUE','UNCONFIRMED') then raise exception 'Care team access, outstanding task and reason required' using errcode='42501';end if;
 if p_action='cancel' and r<>'clinician' then raise exception 'Clinician required to cancel';end if;
 if p_action='snooze' then
 if p_due is null or p_due<=now() or p_due>now()+interval '30 days' then raise exception 'Reschedule within the next 30 days';end if;
 update public.care_loops set due_at=p_due,reminded_at=null,next_owner='patient' where id=p_loop;
 else update public.care_loops set state='CANCELLED',next_owner='none' where id=p_loop;end if;
 update public.support_tasks set status='cancelled' where loop_id=p_loop and status='open';
 update public.message_outbox set delivery_status='failed' where loop_id=p_loop and delivery_status='pending';
 select to_jsonb(c) into outcome from public.care_loops c where id=p_loop;
 insert into public.audit_events(patient_id,loop_id,actor_id,actor_role,action,previous_state,next_state,note,event_key) values(l.patient_id,p_loop,auth.uid(),r,p_action,l.state,outcome->>'state',trim(p_note),p_event);
 update private.request_keys k set result=outcome where k.actor_id=auth.uid() and k.event_key=p_event;return outcome;
end$$;
create function public.manage_care_loop(p_loop uuid,p_action text,p_due timestamptz,p_note text,p_event uuid) returns jsonb language sql security invoker set search_path='' as $$select private.manage_loop(p_loop,p_action,p_due,p_note,p_event);$$;
revoke all on function private.manage_loop(uuid,text,timestamptz,text,uuid),public.manage_care_loop(uuid,text,timestamptz,text,uuid) from public,anon;
grant execute on function private.manage_loop(uuid,text,timestamptz,text,uuid),public.manage_care_loop(uuid,text,timestamptz,text,uuid) to authenticated;
commit;

create function private.confirm_plan(p_patient uuid,p_plan uuid,p_data jsonb,p_note text) returns jsonb language plpgsql security definer set search_path='' as $$begin if auth.uid() is null or private.patient_role(p_patient) is distinct from 'clinician' then raise exception 'Assigned clinician required' using errcode='42501';end if;perform 1 from public.patients where id=p_patient for update;if exists(select 1 from public.care_plans where id=p_plan and patient_id=p_patient and status='confirmed') then return jsonb_build_object('already_confirmed',true);end if;perform private.save_plan(p_patient,p_plan,p_data);return private.review_plan(p_plan,'confirm',p_note);end$$;
create function public.confirm_care_plan(p_patient uuid,p_plan uuid,p_data jsonb,p_note text) returns jsonb language sql security invoker set search_path='' as $$select private.confirm_plan(p_patient,p_plan,p_data,p_note);$$;
revoke all on function private.confirm_plan(uuid,uuid,jsonb,text),public.confirm_care_plan(uuid,uuid,jsonb,text) from public,anon;
grant execute on function private.confirm_plan(uuid,uuid,jsonb,text),public.confirm_care_plan(uuid,uuid,jsonb,text) to authenticated;

create extension if not exists pg_cron;
select cron.schedule('wholecare-plan-scheduler','*/5 * * * *','select private.plan_scheduler()');
