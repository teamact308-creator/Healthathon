create or replace function private.act(p_loop uuid,p_action text,p_event_key uuid,p_note text default '') returns jsonb
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
 if p_action in ('complete','evidence','remind','support') and l.due_at>now() then raise exception 'Scheduled occurrence is not due yet'; end if;
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
create function private.demo_consent(p_patient uuid,p_granted boolean,p_event_key uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare caregiver uuid;
begin
 if auth.uid() is null or private.patient_role(p_patient) is distinct from 'patient' then raise exception 'Only assigned patient can change consent' using errcode='42501'; end if;
 select user_id into caregiver from private.memberships where patient_id=p_patient and role='caregiver' and active order by user_id limit 1;
 if caregiver is null then raise exception 'No assigned caregiver'; end if;
 return private.set_consent(p_patient,caregiver,p_granted,p_event_key);
end $$;
create function public.demo_caregiver_consent(p_patient uuid,p_granted boolean,p_event_key uuid) returns boolean language sql security invoker set search_path='' as $$select private.demo_consent(p_patient,p_granted,p_event_key);$$;
revoke all on function private.demo_consent(uuid,boolean,uuid),public.demo_caregiver_consent(uuid,boolean,uuid) from public,anon;
grant execute on function private.demo_consent(uuid,boolean,uuid),public.demo_caregiver_consent(uuid,boolean,uuid) to authenticated;


