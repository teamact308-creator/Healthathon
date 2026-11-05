-- Synthetic fixtures, transactional rollback. No external calls or provider sends.
begin;
do $$declare patient uuid;clinician uuid;pu uuid;plan uuid:=gen_random_uuid();ex uuid:=gen_random_uuid();body jsonb;item jsonb;proposal jsonb;f text;n integer;begin
 select id,user_id into patient,pu from public.patients where synthetic limit 1;
 select user_id into clinician from private.memberships where patient_id=patient and role='clinician' and active limit 1;
 item:=jsonb_build_object('domain','medication','label','Fictional half tablet instruction','source_excerpt','Fictional half tablet instruction','cadence','weekly','weekdays',jsonb_build_array(extract(dow from now() at time zone 'UTC')::integer),'start_date',(now() at time zone 'UTC')::date,'end_date',(now() at time zone 'UTC')::date+14,'times',jsonb_build_array('00:00'),'evidence','[]'::jsonb,'exceptions','[]'::jsonb);
 proposal:=jsonb_build_object('contract_version',1,'items',jsonb_build_array(item));
 insert into public.plan_extractions(id,patient_id,actor_id,source_text,model,proposal) values(ex,patient,clinician,'Fictional half tablet instruction','synthetic-test',proposal);
 body:=jsonb_build_object('source_note','Fictional verification source','extraction_id',ex,'timezone','UTC','items',jsonb_build_array(item||jsonb_build_object('proposal_index',0,'original',item,'review','{}'::jsonb,'reason','Checked fictional source')),'vcpi','{"version":1,"excluded":[],"source_reviewed":false,"completeness_reviewed":false}'::jsonb);
 perform set_config('request.jwt.claim.sub',pu::text,true);
 begin perform public.confirm_care_plan(patient,plan,body,'Denied patient');raise exception 'patient accepted';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',clinician::text,true);
 perform public.save_care_plan(patient,plan,body);
 if exists(select 1 from public.care_loops l join public.care_plan_items i on i.id=l.item_id where i.plan_id=plan) then raise exception 'Draft created tasks';end if;
 begin perform public.review_care_plan(plan,'confirm','Bypass attempt');raise exception 'unchecked accepted';exception when raise_exception then if sqlerrm='unchecked accepted' then raise;end if;end;
 begin perform public.confirm_care_plan(patient,plan,body-'vcpi','Bypass contract');raise exception 'legacy bypass accepted';exception when raise_exception then if sqlerrm='legacy bypass accepted' then raise;end if;end;
 body:=jsonb_set(body,'{vcpi,source_reviewed}','true');body:=jsonb_set(body,'{vcpi,completeness_reviewed}','true');
 foreach f in array array['domain','label','source_excerpt','cadence','weekdays','start_date','end_date','times'] loop body:=jsonb_set(body,array['items','0','review',f],'true');end loop;
 begin perform public.confirm_care_plan(patient,plan,jsonb_set(body,'{items,0,original,label}','"tampered"'),'Bad provenance');raise exception 'tampered accepted';exception when raise_exception then if sqlerrm='tampered accepted' then raise;end if;end;
 begin perform public.confirm_care_plan(patient,plan,jsonb_set(body,'{items}','[]'),'Dropped item');raise exception 'omission accepted';exception when raise_exception then if sqlerrm='omission accepted' then raise;end if;end;
 begin perform public.confirm_care_plan(patient,plan,jsonb_set(body,'{items,0,source_excerpt}','"PRN fictional instruction"'),'Conditional');raise exception 'PRN accepted';exception when raise_exception then if sqlerrm='PRN accepted' then raise;end if;end;
 perform public.confirm_care_plan(patient,plan,body,'Verified synthetic weekly plan');
 select count(*) into n from public.care_loops l join public.care_plan_items i on i.id=l.item_id where i.plan_id=plan;
 if n<>3 then raise exception 'Expected 3 weekly tasks, got %',n;end if;
 perform public.confirm_care_plan(patient,plan,body,'Retry');
 if (select count(*) from public.care_loops l join public.care_plan_items i on i.id=l.item_id where i.plan_id=plan)<>3 then raise exception 'Duplicate activation';end if;
 if not exists(select 1 from public.plan_activity where plan_id=plan and details->'items' is not null) then raise exception 'Missing field history';end if;
end$$;
rollback;
