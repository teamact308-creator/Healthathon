begin;
create unique index intake_source_once on public.intake_items(source_path) where source_path is not null;
alter table public.processing_events add column resolved_by uuid references auth.users;
create or replace function private.resolve_failure(p_id uuid) returns void language plpgsql security definer set search_path='' as $$declare p uuid;begin
 select patient_id into p from public.processing_events where id=p_id;
 if auth.uid() is null or coalesce(private.patient_role(p),'') not in ('clinician','coordinator') then raise exception 'Care team required' using errcode='42501';end if;
 update public.processing_events set resolved_at=coalesce(resolved_at,now()),resolved_by=coalesce(resolved_by,auth.uid()) where id=p_id;
end$$;
create function private.check_intake_evidence() returns trigger language plpgsql security definer set search_path='' as $$declare i public.intake_items;begin
 select * into i from public.intake_items where source_path=new.storage_path for update;
 if found then
 if i.state<>'matched' or i.loop_id is distinct from new.loop_id or i.patient_id is distinct from new.patient_id or new.is_fixture or not exists(select 1 from public.patients where id=i.patient_id and user_id=new.submitted_by) then raise exception 'Intake association changed; refresh and confirm again';end if;
 update public.intake_items set state='resolved',updated_at=now() where id=i.id;
 insert into public.intake_activity(patient_id,intake_id,actor_id,action,reason) values(i.patient_id,i.id,new.submitted_by,'verified_submission','Patient-confirmed association; server-validated evidence received; clinician review remains required');
 end if;return new;
end$$;
create trigger validate_intake_association before insert on public.evidence for each row execute function private.check_intake_evidence();
revoke all on function private.check_intake_evidence() from public,anon,authenticated;
-- The finish call is a recovery acknowledgment after atomic evidence registration.
create or replace function private.resolve_intake(p_intake uuid,p_action text,p_loop uuid,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.intake_items;r text;new_state text;begin
 select * into i from public.intake_items where id=p_intake for update;r:=private.patient_role(i.patient_id);
 if auth.uid() is null or r is null then raise exception 'Intake not accessible' using errcode='42501';end if;
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

commit;
