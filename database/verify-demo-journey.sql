-- Disposable SQL-contract rehearsal. Auth rows and all actions roll back.
-- This does not claim real GoTrue login, object bytes, browser or provider verification.
begin;
do $$declare run integer;pu uuid;cl uuid;co uuid;cg uuid;patient uuid;clinic uuid;plan uuid;body jsonb;item jsonb;domain text;med uuid;meal uuid;investigation uuid;future uuid;help uuid;key uuid;result jsonb;path text;before_count integer;begin
 for run in 1..2 loop
 pu:=gen_random_uuid();cl:=gen_random_uuid();co:=gen_random_uuid();cg:=gen_random_uuid();patient:=gen_random_uuid();plan:=gen_random_uuid();
 insert into auth.users(id,email) values(pu,'patient-'||pu||'@wholecare.test'),(cl,'clinician-'||cl||'@wholecare.test'),(co,'coordinator-'||co||'@wholecare.test'),(cg,'caregiver-'||cg||'@wholecare.test');
 insert into public.clinics(name) values('Disposable rehearsal '||run) returning id into clinic;
 insert into public.profiles(id,display_name) values(pu,'Rehearsal patient'),(cl,'Rehearsal clinician'),(co,'Rehearsal coordinator'),(cg,'Rehearsal caregiver');
 insert into public.patients(id,clinic_id,user_id,display_name,timezone) values(patient,clinic,pu,'Disposable journey '||run,'UTC');
 insert into private.memberships(patient_id,user_id,role) values(patient,cl,'clinician'),(patient,co,'coordinator'),(patient,cg,'caregiver');
 body:=jsonb_build_object('source_note','Disposable synthetic rehearsal: medication, lunch, monitoring and investigation. No medical advice.','timezone','UTC','items','[]'::jsonb);
 foreach domain in array array['medication','meals','glucose','test'] loop
 item:=jsonb_build_object('domain',domain,'label','Rehearsal '||domain,'cadence','once','start_date',(now() at time zone 'UTC')::date,'end_date',(now() at time zone 'UTC')::date,'times',jsonb_build_array('00:00'),'source_excerpt','Synthetic operational instruction');
 body:=jsonb_set(body,'{items}',(body->'items')||jsonb_build_array(item));
 end loop;
 perform set_config('request.jwt.claim.sub',cl::text,true);
 perform public.save_care_plan(patient,plan,body);
 if exists(select 1 from public.care_loops where patient_id=patient) then raise exception 'Draft created tasks';end if;
 perform public.confirm_care_plan(patient,plan,body,'Reviewed synthetic manual source');
 select l.id into med from public.care_loops l join public.care_plan_items i on i.id=l.item_id where l.patient_id=patient and i.domain='medication';
 select l.id into meal from public.care_loops l join public.care_plan_items i on i.id=l.item_id where l.patient_id=patient and i.domain='meals';
 select l.id into investigation from public.care_loops l join public.care_plan_items i on i.id=l.item_id where l.patient_id=patient and i.domain='test';
 perform set_config('request.jwt.claim.sub',pu::text,true);
 key:=gen_random_uuid();perform public.log_care_activity(med,'taken',jsonb_build_object('note','I recorded the dose as taken.'),key);perform public.log_care_activity(med,'taken',jsonb_build_object('note','I recorded the dose as taken.'),key);
 if (select count(*) from public.care_events where loop_id=med)<>1 then raise exception 'Retry duplicated activity';end if;
 if (select state from public.care_loops where id=med)<>'CLOSED' then raise exception 'Activity not persisted';end if;
 key:=gen_random_uuid();help:=public.request_activity_help(meal,'Help me organise lunch.',key);
 if public.request_activity_help(meal,'Help me organise lunch.',key)<>help then raise exception 'Retry duplicated help';end if;
 perform set_config('request.jwt.claim.sub',co::text,true);
 perform public.update_help_thread(help,'claim','',gen_random_uuid());
 key:=gen_random_uuid();perform public.update_help_thread(help,'reply','I can help organise the next step.',key);perform public.update_help_thread(help,'reply','I can help organise the next step.',key);
 perform set_config('request.jwt.claim.sub',cl::text,true);
 begin perform public.update_help_thread(help,'resolve','Wrong owner',gen_random_uuid());raise exception 'Unclaimed owner resolved';exception when insufficient_privilege then null;when raise_exception then if sqlerrm='Unclaimed owner resolved' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',pu::text,true);perform public.update_help_thread(help,'reply','Thank you, please proceed.',gen_random_uuid());
 perform set_config('request.jwt.claim.sub',co::text,true);perform public.update_help_thread(help,'resolve','Practical support completed.',gen_random_uuid());
 if (select state from public.care_loops where id=meal)<>'DUE' then raise exception 'Help resolution completed activity';end if;
 -- Permission denied before any report state changes.
 perform set_config('request.jwt.claim.sub',pu::text,true);
 begin perform public.care_action(investigation,'review',gen_random_uuid(),'Patient cannot review');raise exception 'Patient reviewed report';exception when insufficient_privilege then null;end;
 path:=patient::text||'/rehearsal-report.png';
 insert into storage.objects(bucket_id,name,owner_id) values('care-evidence',path,pu::text);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',pu,'role','service_role')::text,true);
 key:=gen_random_uuid();result:=public.register_verified_report(pu,investigation,path,repeat('a',64),'Synthetic original report',key);
 perform public.register_verified_report(pu,investigation,path,repeat('a',64),'Synthetic original report',key);
 if (select count(*) from public.evidence where loop_id=investigation)<>1 or result->>'state'<>'REVIEW_PENDING' then raise exception 'Report receipt/retry failed';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',cl,'role','authenticated')::text,true);perform set_config('request.jwt.claim.sub',cl::text,true);
 perform public.care_action(investigation,'review',gen_random_uuid(),'Read the synthetic original and completed operational review.');
 if (select state from public.care_loops where id=investigation)<>'CLOSED' then raise exception 'Clinician review did not close';end if;
 -- Route bounded practical support, then revoke consent.
 perform set_config('request.jwt.claim.sub',co::text,true);perform public.care_action(meal,'remind',gen_random_uuid(),'Synthetic in-app reminder');
 begin perform public.care_action(meal,'support',gen_random_uuid(),'No consent');raise exception 'Support bypassed consent';exception when raise_exception then if sqlerrm='Support bypassed consent' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',pu::text,true);perform public.set_caregiver_consent(patient,cg,true,gen_random_uuid());
 perform set_config('request.jwt.claim.sub',co::text,true);perform public.care_action(meal,'support',gen_random_uuid(),'Consented practical support');
 perform set_config('request.jwt.claim.sub',cg::text,true);
 if not private.caregiver_allowed(patient,cg) then raise exception 'Consent not effective';end if;
 begin perform public.log_care_activity(meal,'meal_logged','{}',gen_random_uuid());raise exception 'Caregiver logged patient activity';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',pu::text,true);perform public.set_caregiver_consent(patient,cg,false,gen_random_uuid());
 if private.caregiver_allowed(patient,cg) then raise exception 'Revocation not effective';end if;
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 begin perform public.request_activity_help(meal,'Unassigned',gen_random_uuid());raise exception 'Wrong patient accepted';exception when insufficient_privilege then null;end;
 end loop;
end$$;
rollback;
select 'PASS: two isolated four-persona SQL journeys, plan confirmation, activity/report/help retries, review, ownership, consent and wrong-patient denials' as result;
