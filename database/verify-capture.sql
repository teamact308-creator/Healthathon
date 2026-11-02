-- Isolated fixture; all changes roll back. No live patient's care tasks change.
begin;set local statement_timeout='8s';
do $$declare clinician uuid;actor uuid:=gen_random_uuid();vp uuid:=gen_random_uuid();plan uuid:=gen_random_uuid();loopid uuid;requestid uuid:=gen_random_uuid();r jsonb;begin
select user_id into clinician from private.memberships where role='clinician' limit 1;
insert into auth.users(id,email) values(actor,'rollback-fixture@wholecare.test');
insert into public.patients(id,clinic_id,user_id,display_name,timezone) select vp,id,actor,'Rollback fixture','UTC' from public.clinics limit 1;
insert into private.memberships(patient_id,user_id,role) values(vp,clinician,'clinician');
perform set_config('request.jwt.claim.sub',clinician::text,true);
perform private.save_plan(vp,plan,jsonb_build_object('source_note','Fictional medication routine','timezone','UTC','items',jsonb_build_array(jsonb_build_object('domain','medication','label','Synthetic routine','cadence','once','start_date',current_date-1,'end_date',current_date-1,'times',jsonb_build_array('08:00')))));
if exists(select 1 from public.care_loops where patient_id=vp) then raise exception 'Unconfirmed plan leaked tasks';end if;
perform private.review_plan(plan,'confirm','Reviewed fixture');
if private.generate_plan(plan)<>0 then raise exception 'Duplicate scheduling';end if;
select id into loopid from public.care_loops where patient_id=vp;
perform set_config('request.jwt.claim.sub',actor::text,true);
r:=private.log_activity(loopid,'delayed',jsonb_build_object('note','Fictional activity delayed'),requestid);
if r->>'state'<>'UNCONFIRMED' then raise exception 'Delayed must remain unconfirmed';end if;
perform private.log_activity(loopid,'delayed',jsonb_build_object('note','Retry'),requestid);
if (select count(*) from public.care_events where patient_id=vp)<>1 then raise exception 'Duplicate activity';end if;
r:=private.log_activity(loopid,'taken',jsonb_build_object('note','Fictional activity completed'),gen_random_uuid());
if r->>'state'<>'CLOSED' then raise exception 'Taken did not close';end if;
r:=private.import_glucose(vp,jsonb_build_array(jsonb_build_object('observed_at',now(),'value',120,'unit','mg/dL','source_id','fixture')));
if (r->>'inserted')::int<>1 then raise exception 'Import failed';end if;
r:=private.import_glucose(vp,jsonb_build_array(jsonb_build_object('observed_at',now(),'value',120,'unit','mg/dL','source_id','fixture')));
if (r->>'duplicates')::int<>1 then raise exception 'Import dedupe failed';end if;
end$$;rollback;select 'PASS: draft gate, medication statuses, occurrence and event idempotency, glucose import/dedupe' as result;
