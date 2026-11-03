-- Additive VCPI provenance. Existing manual contracts remain compatible; AI-linked plans require VCPI review.
begin;
alter table public.care_plans add column vcpi_data jsonb;
alter table public.plan_activity add column details jsonb;
create function private.vcpi_check(p_patient uuid,p_data jsonb,p_confirm boolean) returns void
language plpgsql security definer set search_path='' as $$
declare v jsonb;f text;ex public.plan_extractions;idx integer;seen integer[]:='{}';n integer;original jsonb;
begin
 if auth.uid() is null or private.patient_role(p_patient) is distinct from 'clinician' then raise exception 'Assigned clinician required' using errcode='42501';end if;
 if p_data->>'extraction_id' is not null then
 select * into ex from public.plan_extractions where id=(p_data->>'extraction_id')::uuid and patient_id=p_patient;
 if not found or ex.source_path is distinct from nullif(p_data->>'source_path','') then raise exception 'Extraction source mismatch';end if;
 if ex.proposal->>'contract_version'='1' and p_data#>>'{vcpi,version}' is distinct from '1' then raise exception 'VCPI review required for extracted plans';end if;
 end if;
 if p_data->'vcpi' is null then return;end if;
 if jsonb_typeof(p_data->'items') is distinct from 'array' or jsonb_typeof(p_data#>'{vcpi,excluded}') is distinct from 'array' then raise exception 'VCPI items and exclusions required';end if;
 if p_confirm and (p_data#>'{vcpi,source_reviewed}' is distinct from 'true'::jsonb or p_data#>'{vcpi,completeness_reviewed}' is distinct from 'true'::jsonb) then raise exception 'Review original source and completeness';end if;
 for v in select value from jsonb_array_elements(p_data->'items') loop
 if p_confirm then
 foreach f in array array['domain','label','source_excerpt','cadence','weekdays','start_date','end_date','times'] loop
 if v#>array['review',f] is distinct from 'true'::jsonb then raise exception 'Every field requires verification';end if;
 end loop;
 if coalesce(length(trim(v->>'reason')),0) not between 1 and 2000 then raise exception 'Review/correction reason required';end if;
 if coalesce(length(trim(v->>'source_excerpt')),0)=0 then raise exception 'Source excerpt required';end if;
 if v#>>'{original,cadence}'='unsupported' or coalesce(v#>>'{original,source_excerpt}','') ~* '\m(as needed|prn|hold|stop|alternate days?|every other|taper|unless)\M' then raise exception 'Unsupported source instruction must be excluded';end if;
 if v->>'cadence' not in ('once','daily','weekly') or coalesce(v->>'source_excerpt','') ~* '\m(as needed|prn|hold|stop|alternate days?|every other|taper|unless)\M' then raise exception 'Unsupported instructions require manual handling';end if;
 if v->>'cadence'='weekly' and (jsonb_typeof(v->'weekdays') is distinct from 'array' or jsonb_array_length(v->'weekdays')=0) then raise exception 'Explicit weekly days required';end if;
 end if;
 end loop;
 -- Every extracted instruction must be included exactly once or explicitly excluded. Added manual actions have no proposal_index.
 if ex.id is not null then
 n:=jsonb_array_length(ex.proposal->'items');
 for v in select value from jsonb_array_elements(p_data->'items') union all select value from jsonb_array_elements(p_data#>'{vcpi,excluded}') loop
 if v->>'proposal_index' is null then continue;end if;
 idx:=(v->>'proposal_index')::integer;
 if idx<0 or idx>=n or idx=any(seen) then raise exception 'Invalid or duplicate proposal reference';end if;
 seen:=array_append(seen,idx);original:=ex.proposal->'items'->idx;
 if v->'original' is distinct from original then raise exception 'Original extraction must be preserved';end if;
 end loop;
 if cardinality(seen)<>n then raise exception 'Every extracted item must be reviewed or excluded';end if;
 end if;
 for v in select value from jsonb_array_elements(p_data#>'{vcpi,excluded}') loop
 if coalesce(length(trim(v->>'reason')),0) not between 1 and 2000 then raise exception 'Exclusion needs manual-handling reason';end if;
 end loop;
end$$;
revoke all on function private.vcpi_check(uuid,jsonb,boolean) from public,anon,authenticated;
create or replace function private.save_plan(p_patient uuid,p_plan uuid,p_data jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare v jsonb; i uuid; ts time[]; d date; e date; existing public.care_plans; tz text; path text; extraction uuid;wd integer[];
begin
 if auth.uid() is null or private.patient_role(p_patient) is distinct from 'clinician' then raise exception 'Assigned clinician required' using errcode='42501';end if;
 perform private.vcpi_check(p_patient,p_data,false);
 perform 1 from public.patients where id=p_patient for update;
 select * into existing from public.care_plans where id=p_plan for update;
 if found and (existing.patient_id<>p_patient or existing.status<>'proposed') then raise exception 'Only your proposed plan can be edited' using errcode='42501';end if;
 if p_plan is null or length(trim(p_data->>'source_note')) not between 1 and 20000 or jsonb_typeof(p_data->'items')<>'array' or jsonb_array_length(p_data->'items') not between (case when p_data->'vcpi' is not null then 0 else 1 end) and 20 then raise exception 'Source note and 1 to 20 items required';end if;
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
 update public.care_plans set vcpi_data=case when p_data->'vcpi' is not null then p_data else null end where id=p_plan;
 insert into public.plan_activity(plan_id,patient_id,actor_id,action,details) values(p_plan,p_patient,auth.uid(),'draft_saved',p_data);
 return p_plan;
end$$;
-- Trigger covers both confirm_care_plan and the older review_care_plan endpoint.
create function private.vcpi_activation_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='confirmed' and old.status='proposed' and (new.vcpi_data is not null or exists(select 1 from public.plan_extractions where id=new.extraction_id and proposal->>'contract_version'='1')) then
 if new.vcpi_data is null then raise exception 'VCPI review required; reopen this legacy extracted draft';end if;
 perform private.vcpi_check(new.patient_id,new.vcpi_data,true);
 end if;
 return new;
end$$;
revoke all on function private.vcpi_activation_guard() from public,anon,authenticated;
create trigger vcpi_activation_guard before update of status on public.care_plans for each row execute function private.vcpi_activation_guard();
commit;
