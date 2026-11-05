-- Explicit synthetic fixtures for the existing Team Act demo clinic only.
-- Idempotent: never overwrites the original patient's records or resets completed fixture work.
do $$
declare clinic uuid; clinician uuid; patient uuid; plan uuid; item uuid; occurrence uuid; request_id uuid;
 spec record; dimension text; day integer; due timestamptz; review boolean;
begin
 select p.clinic_id,m.user_id into clinic,clinician from public.patients p join private.memberships m on m.patient_id=p.id and m.role='clinician' and m.active where p.synthetic and p.display_name='Anita Sen' order by p.created_at limit 1;
 if clinic is null then raise exception 'Existing synthetic Team Act workspace required';end if;
 for spec in select * from (values ('Ravi Mehta','en',1),('Farah Khan','hi',2)) x(name,language,variant) loop
  if exists(select 1 from public.patients where clinic_id=clinic and display_name=spec.name) then continue;end if;
  insert into public.patients(clinic_id,display_name,language,synthetic) values(clinic,spec.name,spec.language,true) returning id into patient;
  insert into private.memberships(patient_id,user_id,role)
   select patient,m.user_id,m.role from private.memberships m join public.patients p on p.id=m.patient_id where p.clinic_id=clinic and p.display_name='Anita Sen' and p.synthetic and m.active and m.role in ('clinician','coordinator') on conflict do nothing;
  insert into public.care_plans(patient_id,status,source_note,confirmed_by,confirmed_at,active)
   values(patient,'confirmed','Synthetic multi-patient fixture v1. Demonstration instructions only; no real prescription.',clinician,now(),true) returning id into plan;
  foreach dimension in array array['medication','meals','glucose','test'] loop
   insert into public.care_plan_items(plan_id,patient_id,domain,label,cadence,requires_human_review,source_excerpt)
   values(plan,patient,dimension,case dimension when 'medication' then 'Record the medication activity from the demo plan' when 'meals' then 'Record lunch and any practical barriers' when 'glucose' then 'Confirm monitoring data availability' else 'Submit the scheduled investigation report' end,'once',dimension='test','Synthetic source: demonstrate this care activity; no treatment recommendation.') returning id into item;
   for day in 0..29 loop
    due:=date_trunc('day',now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'-make_interval(days=>day)+interval '8 hours';
    review:=day=0 and dimension='test' and spec.variant=2;
    insert into public.care_loops(item_id,patient_id,due_at,scheduled_for,state,next_owner,closed_at,review_note)
     values(item,patient,due,due,case when day>0 then 'CLOSED' when review then 'REVIEW_PENDING' else 'DUE' end,case when day>0 then 'none' when review then 'clinician' else 'patient' end,case when day>0 then due+interval '15 minutes' end,case when day>0 then 'Synthetic historical activity' end) returning id into occurrence;
    if day>0 and dimension<>'test' then
     insert into public.care_events(patient_id,loop_id,actor_id,domain,status,occurred_at,details)
      values(patient,occurrence,clinician,dimension,case when dimension='medication' and mod(day,7)=spec.variant then 'delayed' else case dimension when 'medication' then 'taken' else 'recorded' end end,due+interval '15 minutes',jsonb_build_object('note',case dimension when 'meals' then case when spec.variant=1 then 'Lunch was later after work; dal and vegetables.' else 'Lunch at home; rice, dal and vegetables.' end when 'medication' then case when mod(day,7)=spec.variant then 'Dose recorded later than planned.' else 'Dose recorded as taken.' end else 'Monitoring availability recorded.' end,'source','synthetic multi-patient fixture'));
    end if;
    if review then insert into public.evidence(patient_id,loop_id,submitted_by,label,is_fixture) values(patient,occurrence,clinician,'Synthetic report placeholder — no laboratory findings',true);end if;
    if day=0 and dimension='meals' and spec.variant=1 then
     insert into public.intake_items(patient_id,created_by,event_key,label,source_text,loop_id) values(patient,clinician,gen_random_uuid(),'Help request: Record lunch and any practical barriers','Synthetic scenario: please help me organise lunch around my work schedule.',occurrence) returning id into request_id;
     insert into public.intake_activity(patient_id,intake_id,actor_id,action,reason) values(patient,request_id,clinician,'submitted','Synthetic scenario seeded by the team; no real patient message.');
    end if;
   end loop;
  end loop;
  insert into public.glucose_observations(patient_id,observed_at,value,unit,source_id,synthetic)
   select patient,now()-make_interval(days=>d)+make_interval(hours=>h),110+spec.variant*12+mod(d*13+h*7,65),'mg/dL','multi-v1-'||d||'-'||h,true from generate_series(0,29) d cross join generate_series(0,1) h;
 end loop;
end $$;
