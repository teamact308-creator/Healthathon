begin;
-- Append-only source history; no browser writes outside checked RPCs.
create table public.patient_context_entries(
 id uuid primary key default gen_random_uuid(),patient_id uuid not null references public.patients,
 kind text not null check(kind in ('hba1c','weight','bp','investigation')),observed_at timestamptz not null,
 value jsonb not null,unit text not null,source_note text not null check(length(source_note) between 1 and 2000),
 supersedes uuid unique,reason text not null check(length(reason) between 1 and 2000),
 actor_id uuid not null references auth.users,event_key uuid not null,created_at timestamptz not null default now(),
 unique(id,patient_id),unique(actor_id,event_key),foreign key(supersedes,patient_id) references public.patient_context_entries(id,patient_id)
);
create index context_patient_time on public.patient_context_entries(patient_id,observed_at desc,id);
create table public.workflow_policy_versions(
 id uuid primary key default gen_random_uuid(),patient_id uuid not null references public.patients,
 policy jsonb not null,reason text not null check(length(reason) between 1 and 2000),actor_id uuid not null references auth.users,
 event_key uuid not null,created_at timestamptz not null default clock_timestamp(),unique(actor_id,event_key)
);
create index policy_patient_time on public.workflow_policy_versions(patient_id,created_at desc,id desc);
create table public.activity_corrections(
 id uuid primary key default gen_random_uuid(),patient_id uuid not null references public.patients,
 event_id uuid not null references public.care_events,actor_id uuid not null references auth.users,
 before_value jsonb not null,after_value jsonb not null,reason text not null check(length(reason) between 1 and 2000),
 event_key uuid not null,created_at timestamptz not null default now(),unique(actor_id,event_key)
);
create index correction_patient_time on public.activity_corrections(patient_id,created_at desc,id);
create index correction_event on public.activity_corrections(event_id);
do $$declare t text;begin foreach t in array array['patient_context_entries','workflow_policy_versions','activity_corrections'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy assigned_clinical_read on public.%I for select to authenticated using(coalesce(private.patient_role(patient_id),'''') in (''patient'',''clinician'',''coordinator''))',t);
 end loop;end$$;
create function private.record_context(p_patient uuid,p_kind text,p_time timestamptz,p_value jsonb,p_unit text,p_source text,p_previous uuid,p_reason text,p_key uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare old public.patient_context_entries;result uuid;begin
 if auth.uid() is null or coalesce(private.patient_role(p_patient),'') not in ('patient','clinician') then raise exception 'Assigned patient or clinician required' using errcode='42501';end if;
 if p_key is null or p_time is null or p_time>now() or length(trim(coalesce(p_source,''))) not between 1 and 2000 or length(trim(coalesce(p_reason,''))) not between 1 and 2000 or p_value is null or jsonb_typeof(p_value)<>'object' then raise exception 'Date, source, value and reason required';end if;
 if not coalesce((p_kind='hba1c' and p_unit in ('%','mmol/mol') and jsonb_typeof(p_value->'value')='number' and (p_value->>'value')::numeric>0 and (p_value->>'value')::numeric<1000000)
 or (p_kind='weight' and p_unit in ('kg','lb') and jsonb_typeof(p_value->'value')='number' and (p_value->>'value')::numeric>0 and (p_value->>'value')::numeric<1000000)
 or (p_kind='bp' and p_unit='mmHg' and jsonb_typeof(p_value->'systolic')='number' and jsonb_typeof(p_value->'diastolic')='number' and (p_value->>'systolic')::numeric>0 and (p_value->>'diastolic')::numeric>0 and (p_value->>'systolic')::numeric<1000000 and (p_value->>'diastolic')::numeric<1000000)
 or (p_kind='investigation' and p_unit='reference' and length(trim(p_value->>'reference')) between 1 and 2000),false) or length(p_value::text)>3000 then raise exception 'Kind, unit and structured value must agree';end if;
 perform 1 from public.patients where id=p_patient for update;
 select * into old from public.patient_context_entries where actor_id=auth.uid() and event_key=p_key;
 if found then if old.patient_id is distinct from p_patient or old.kind is distinct from p_kind or old.observed_at is distinct from p_time or old.value is distinct from p_value or old.unit is distinct from p_unit or old.source_note is distinct from trim(p_source) or old.supersedes is distinct from p_previous or old.reason is distinct from trim(p_reason) then raise exception 'Request key mismatch';end if;return old.id;end if;
 if p_previous is not null and not exists(select 1 from public.patient_context_entries x where x.id=p_previous and x.patient_id=p_patient and x.kind=p_kind and not exists(select 1 from public.patient_context_entries y where y.supersedes=x.id)) then raise exception 'Context changed; reload before correcting';end if;
 insert into public.patient_context_entries(patient_id,kind,observed_at,value,unit,source_note,supersedes,reason,actor_id,event_key) values(p_patient,p_kind,p_time,p_value,p_unit,trim(p_source),p_previous,trim(p_reason),auth.uid(),p_key) returning id into result;return result;
end$$;
create function public.record_patient_context(p_patient uuid,p_kind text,p_time timestamptz,p_value jsonb,p_unit text,p_source text,p_previous uuid,p_reason text,p_key uuid) returns uuid language sql security invoker set search_path='' as $$select private.record_context(p_patient,p_kind,p_time,p_value,p_unit,p_source,p_previous,p_reason,p_key);$$;
create function private.save_workflow_policy(p_patient uuid,p_policy jsonb,p_previous uuid,p_reason text,p_key uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare current_id uuid;old public.workflow_policy_versions;k text;v jsonb;result uuid;begin
 if auth.uid() is null or private.patient_role(p_patient) is distinct from 'clinician' then raise exception 'Assigned clinician required' using errcode='42501';end if;
 if p_key is null or jsonb_typeof(p_policy) is distinct from 'object' or length(trim(coalesce(p_reason,''))) not between 1 and 2000 then raise exception 'Policy and reason required';end if;
 if (select count(*) from jsonb_object_keys(p_policy))<>3 or not(p_policy?'windows' and p_policy?'stale_hours' and p_policy?'overdue_hours') or jsonb_typeof(p_policy->'windows') is distinct from 'object' then raise exception 'Invalid policy keys';end if;
 if (select count(*) from jsonb_object_keys(p_policy->'windows'))<>4 then raise exception 'Four domain windows required';end if;
 foreach k in array array['medication','meals','glucose','test'] loop v:=p_policy->'windows'->k;
 if v is null or (v<>'null'::jsonb and (jsonb_typeof(v)<>'number' or (v::text)::numeric not between 0 and 525600 or (v::text)::numeric<>trunc((v::text)::numeric))) then raise exception 'Windows must be null or integer minutes up to one year';end if;end loop;
 foreach k in array array['stale_hours','overdue_hours'] loop v:=p_policy->k;
 if v is null or (v<>'null'::jsonb and (jsonb_typeof(v)<>'number' or (v::text)::numeric not between 1 and 8760 or (v::text)::numeric<>trunc((v::text)::numeric))) then raise exception 'Age must be null or integer hours up to one year';end if;end loop;
 perform 1 from public.patients where id=p_patient for update;
 select * into old from public.workflow_policy_versions where actor_id=auth.uid() and event_key=p_key;
 if found then if old.patient_id is distinct from p_patient or old.policy is distinct from p_policy or old.reason is distinct from trim(p_reason) then raise exception 'Request key mismatch';end if;return old.id;end if;
 select id into current_id from public.workflow_policy_versions where patient_id=p_patient order by created_at desc,id desc limit 1;
 if current_id is distinct from p_previous then raise exception 'Policy changed; reload before saving';end if;
 insert into public.workflow_policy_versions(patient_id,policy,reason,actor_id,event_key) values(p_patient,p_policy,trim(p_reason),auth.uid(),p_key) returning id into result;return result;
end$$;
create function public.save_workflow_policy(p_patient uuid,p_policy jsonb,p_previous uuid,p_reason text,p_key uuid) returns uuid language sql security invoker set search_path='' as $$select private.save_workflow_policy(p_patient,p_policy,p_previous,p_reason,p_key);$$;
create function private.correct_activity(p_id uuid,p_expected jsonb,p_status text,p_note text,p_time timestamptz,p_reason text,p_key uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare e public.care_events;l public.care_loops;old public.activity_corrections;r text;result uuid;payload jsonb;new_state text;begin
 select * into e from public.care_events where id=p_id;r:=private.patient_role(e.patient_id);
 if auth.uid() is null or coalesce(r,'') not in ('patient','clinician') or (r='patient' and e.actor_id is distinct from auth.uid()) then raise exception 'Assigned author or clinician required' using errcode='42501';end if;
 select * into l from public.care_loops where id=e.loop_id for update;
 select * into e from public.care_events where id=p_id for update;
 if p_key is null or length(trim(coalesce(p_note,''))) not between 1 and 2000 or length(trim(coalesce(p_reason,''))) not between 1 and 2000 or p_time is null or p_time>now() or p_time<now()-interval '30 days' then raise exception 'Time, description and correction reason required';end if;
 if not coalesce((e.domain='medication' and p_status in ('taken','missed','delayed','skipped_by_instruction')) or (e.domain='meals' and p_status='meal_logged') or (e.domain='glucose' and p_status='availability_confirmed'),false) then raise exception 'Status does not match domain';end if;
 payload:=jsonb_build_object('status',p_status,'note',trim(p_note),'occurred_at',p_time);
 select * into old from public.activity_corrections where actor_id=auth.uid() and event_key=p_key;
 if found then if old.event_id is distinct from p_id or old.after_value is distinct from payload or old.reason is distinct from trim(p_reason) then raise exception 'Request key mismatch';end if;return old.id;end if;
 if p_expected is distinct from jsonb_build_object('status',e.status,'note',e.details->>'note','occurred_at',e.occurred_at) then raise exception 'Activity changed; reload before correcting';end if;
 if l.state in ('REVIEW_PENDING','CANCELLED') or exists(select 1 from public.audit_events where loop_id=l.id and action in ('review','reopen','snooze','cancel') and created_at>coalesce((e.details->>'recorded_at')::timestamptz,e.occurred_at)) then raise exception 'Team intervention exists; resolve with care team';end if;
 insert into public.activity_corrections(patient_id,event_id,actor_id,before_value,after_value,reason,event_key) values(e.patient_id,e.id,auth.uid(),p_expected,payload,trim(p_reason),p_key) returning id into result;
 update public.care_events set status=p_status,occurred_at=p_time,details=details||jsonb_build_object('note',trim(p_note),'activity_at',p_time,'last_correction_id',result) where id=e.id;
 -- Only the latest recorded activity may revise the current loop state. Old records remain historical.
 if e.id=(select id from public.care_events where loop_id=l.id order by coalesce((details->>'recorded_at')::timestamptz,occurred_at) desc,id desc limit 1) then
 new_state:=case when p_status in ('taken','meal_logged','availability_confirmed') then 'CLOSED' else 'UNCONFIRMED' end;
 update public.care_loops set state=new_state,next_owner=case when new_state='CLOSED' then 'none' else 'patient' end,closed_at=case when new_state='CLOSED' then coalesce(l.closed_at,now()) else null end where id=l.id;
 end if;
 insert into public.audit_events(patient_id,loop_id,actor_id,actor_role,action,previous_state,next_state,note,event_key) values(e.patient_id,l.id,auth.uid(),r,'activity_corrected',l.state,(select state from public.care_loops where id=l.id),trim(p_reason),p_key);return result;
end$$;
create function public.correct_care_activity(p_id uuid,p_expected jsonb,p_status text,p_note text,p_time timestamptz,p_reason text,p_key uuid) returns uuid language sql security invoker set search_path='' as $$select private.correct_activity(p_id,p_expected,p_status,p_note,p_time,p_reason,p_key);$$;
-- Explicit grants; caregiver and unassigned users are rejected inside every checked function.
do $$declare f record;begin for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','public') and p.proname in ('record_context','record_patient_context','save_workflow_policy','correct_activity','correct_care_activity') loop
 execute format('revoke all on function %s from public,anon',f.signature);execute format('grant execute on function %s to authenticated',f.signature);end loop;end$$;
alter table public.care_plan_items drop constraint care_plan_items_cadence_check;
alter table public.care_plan_items add constraint care_plan_items_cadence_check check(cadence in ('once','daily','weekly'));
alter table public.plan_schedules add column weekdays integer[] not null default '{}',add constraint valid_weekdays check(cardinality(weekdays)<=7 and weekdays<@array[0,1,2,3,4,5,6]);

create or replace function private.save_plan(p_patient uuid,p_plan uuid,p_data jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare v jsonb; i uuid; ts time[]; d date; e date; existing public.care_plans; tz text; path text; extraction uuid;wd integer[];
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
 if v->>'domain' not in ('medication','meals','glucose','test') or length(trim(v->>'label')) not between 1 and 300 or coalesce(v->>'cadence','') not in ('once','daily','weekly') then raise exception 'Valid domain, label and cadence required';end if;
 if v->>'cadence'='weekly' then
 if jsonb_typeof(v->'weekdays') is distinct from 'array' then raise exception 'Choose weekly weekdays';end if;
 select array_agg(distinct value::integer order by value::integer) into wd from jsonb_array_elements_text(v->'weekdays');
 if wd is null or cardinality(wd) not between 1 and 7 or not(wd<@array[0,1,2,3,4,5,6]) then raise exception 'Choose weekdays Sunday=0 through Saturday=6';end if;
 else wd:='{}';end if;
 d:=(v->>'start_date')::date;e:=(v->>'end_date')::date;
 if d is null or e is null or e<d or e>d+365 or d<(now() at time zone tz)::date-1 then raise exception 'Schedule must start no earlier than yesterday and last at most one year';end if;
 select array_agg(distinct value::time order by value::time) into ts from jsonb_array_elements_text(v->'times');
 if ts is null or cardinality(ts) not between 1 and 4 or exists(select 1 from unnest(ts) t where t>=time '24:00') then raise exception 'Choose 1 to 4 distinct daily times';end if;
 if v->>'cadence'='once' and (d<>e or cardinality(ts)<>1) then raise exception 'One-off task requires one date and time';end if;
 insert into public.care_plan_items(plan_id,patient_id,domain,label,cadence,requires_human_review,source_excerpt)
 values(p_plan,p_patient,v->>'domain',trim(v->>'label'),v->>'cadence',v->>'domain'='test',left(coalesce(v->>'source_excerpt',''),2000)) returning id into i;
 insert into public.plan_schedules(item_id,patient_id,start_date,end_date,times,weekdays) values(i,p_patient,d,e,ts,wd);
 end loop;
 insert into public.plan_activity(plan_id,patient_id,actor_id,action) values(p_plan,p_patient,auth.uid(),'draft_saved');
 return p_plan;
end$$;
create or replace function private.generate_plan(p_plan uuid) returns integer language plpgsql security definer set search_path='' as $$
declare n integer;begin
 insert into public.care_loops(item_id,patient_id,due_at,scheduled_for)
 select i.id,i.patient_id,(day::date+t) at time zone p.timezone,(day::date+t) at time zone p.timezone
 from public.care_plans p join public.care_plan_items i on i.plan_id=p.id join public.plan_schedules s on s.item_id=i.id
 cross join lateral generate_series(s.start_date::timestamp,least(s.end_date,(now() at time zone p.timezone)::date+14)::timestamp,interval '1 day') day
 cross join lateral unnest(s.times) t
 where p.id=p_plan and p.status='confirmed' and p.active and (i.cadence='daily' or (i.cadence='once' and day::date=s.start_date) or (i.cadence='weekly' and extract(dow from day)::integer=any(s.weekdays)))
 on conflict do nothing;get diagnostics n=row_count;return n;end$$;

create or replace function private.operational_snapshot(p_patient uuid,p_from timestamptz,p_to timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$declare result jsonb;begin
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
 'context',(select coalesce(jsonb_agg(x),'[]') from public.patient_context_entries x where patient_id=p_patient and observed_at<p_to),
 'policy',(select to_jsonb(x) from public.workflow_policy_versions x where patient_id=p_patient order by created_at desc,id desc limit 1),
 'corrections',(select coalesce(jsonb_agg(x),'[]') from public.activity_corrections x where patient_id=p_patient and created_at>=p_from and created_at<p_to),
 'delivery',(select coalesce(jsonb_agg(x),'[]') from public.delivery_jobs x where patient_id=p_patient)) into result;
 return result;
end$$;
commit;
