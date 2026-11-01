-- Synthetic fixtures only. Requires the four development Auth identities first.
do $$ declare clinic uuid; patient uuid; plan uuid; item uuid; pid uuid; doctor uuid; coordinator uuid; caregiver uuid; d text; begin
 select id into pid from auth.users where email='patient@wholecare.test';
 select id into doctor from auth.users where email='clinician@wholecare.test';
 select id into coordinator from auth.users where email='coordinator@wholecare.test';
 select id into caregiver from auth.users where email='caregiver@wholecare.test';
 if pid is null or doctor is null or coordinator is null or caregiver is null then raise exception 'Provision all four test Auth identities first'; end if;
 if exists(select 1 from public.patients where user_id=pid) then raise exception 'Demo already seeded; refusing duplicate fixtures'; end if;
 insert into public.profiles(id,display_name) values(pid,'Anita Sen (synthetic)'),(doctor,'Demo clinician'),(coordinator,'Demo coordinator'),(caregiver,'Riya (synthetic caregiver)');
 insert into public.clinics(name) values('Team Act Demo Clinic') returning id into clinic;
 insert into public.patients(clinic_id,user_id,display_name) values(clinic,pid,'Anita Sen') returning id into patient;
 insert into private.memberships(patient_id,user_id,role) values(patient,doctor,'clinician'),(patient,coordinator,'coordinator'),(patient,caregiver,'caregiver');
 -- Consent intentionally starts off. The patient must actively grant support access.
 insert into private.caregiver_consents(patient_id,caregiver_id,granted) values(patient,caregiver,false);
 insert into public.care_plans(patient_id,status,source_note,confirmed_by,confirmed_at)
 values(patient,'confirmed','SYNTHETIC confirmed demo plan: morning medication routine; breakfast log; monitoring data sync; renal-function report for human review.',doctor,now()) returning id into plan;
 foreach d in array array['medication','meals','glucose','test'] loop
 insert into public.care_plan_items(plan_id,patient_id,domain,label,cadence,requires_human_review)
 values(plan,patient,d,case d when 'medication' then 'Morning medication routine' when 'meals' then 'Breakfast check-in' when 'glucose' then 'Monitoring data sync' else 'Renal-function investigation' end,case when d='test' then 'once' else 'daily' end,d='test') returning id into item;
 insert into public.care_loops(item_id,patient_id,due_at,state) values(item,patient,now()-interval '10 minutes',case when d='medication' then 'UNCONFIRMED' else 'DUE' end);
 if d<>'test' then
 insert into public.care_loops(item_id,patient_id,due_at,state) values(item,patient,(date_trunc('day',now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata')+interval '1 day 8 hours','DUE');
 end if;
 end loop;
 insert into public.glucose_observations(patient_id,observed_at,value,unit,source_id)
 select patient,now()-n*interval '5 minutes',112+n,'mg/dL','synthetic-fixture-1' from generate_series(0,2) n;
end $$;
