-- Route help actions through the owner-checked conversation RPC.
create or replace function private.resolve_intake(p_intake uuid,p_action text,p_loop uuid,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.intake_items;r text;new_state text;begin
 select * into i from public.intake_items where id=p_intake for update;r:=private.patient_role(i.patient_id);
 if auth.uid() is null or r is null then raise exception 'Intake not accessible' using errcode='42501';end if;
 if i.loop_id is not null and i.source_path is null and i.label like 'Help request: %' then raise exception 'Use the help conversation workflow' using errcode='42501';end if;
 if length(trim(coalesce(p_reason,''))) not between 1 and 2000 then raise exception 'Reason required';end if;
 if p_action='finish' and r='patient' and i.state='resolved' and exists(select 1 from public.evidence e where e.loop_id=i.loop_id and e.patient_id=i.patient_id and e.storage_path=i.source_path and not e.is_fixture) then return to_jsonb(i);end if;
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

-- Reserve external delivery only for due occurrences from active confirmed plans.
create or replace function private.claim_delivery(p_job uuid,p_version integer) returns jsonb language plpgsql security definer set search_path='' as $$declare j public.delivery_jobs;begin
 select * into j from public.delivery_jobs where id=p_job for update skip locked;
 if not found or j.version<>p_version or j.state<>'pending' or j.attempts>=3 or j.provider_id is not null or j.not_before>now() then return null;end if;
 perform 1 from public.patients where id=j.patient_id for update;
 if not exists(select 1 from private.channel_gates where channel=j.channel and enabled) or not exists(select 1 from private.channel_enrollments where patient_id=j.patient_id and channel=j.channel and consented and verified_at is not null) then return null;end if;
 if not exists(select 1 from public.message_outbox m join public.care_loops l on l.id=m.loop_id join public.care_plan_items i on i.id=l.item_id join public.care_plans p on p.id=i.plan_id where m.id=j.outbox_id and m.delivery_status='pending' and l.state in ('DUE','UNCONFIRMED') and l.due_at<=now() and p.active and p.status='confirmed') then
 update public.delivery_jobs set state='cancelled',updated_at=now(),version=version+1 where id=j.id;return null;end if;
 update public.delivery_jobs set state='reserved',attempts=attempts+1,version=version+1,updated_at=now() where id=j.id returning * into j;return to_jsonb(j);
end$$;
