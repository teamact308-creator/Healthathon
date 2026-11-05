create function private.workspace_revision(p_patient uuid) returns text language plpgsql stable security definer set search_path='' as $$
declare role_name text:=private.patient_role(p_patient);value jsonb;begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 if role_name is null then
  if not exists(select 1 from private.memberships where patient_id=p_patient and user_id=auth.uid() and role='caregiver' and active) then raise exception 'Assigned access required' using errcode='42501';end if;
  return md5(coalesce((select jsonb_agg(jsonb_build_array(t.id,t.status))::text from public.support_tasks t where t.patient_id=p_patient and t.caregiver_id=auth.uid() and private.caregiver_allowed(p_patient,auth.uid())),'[]'));
 end if;
 select jsonb_build_array(
  (select jsonb_agg(jsonb_build_array(id,state,next_owner,due_at,closed_at,review_note) order by id) from public.care_loops where patient_id=p_patient),
  (select jsonb_agg(jsonb_build_array(id,status,active) order by id) from public.care_plans where patient_id=p_patient),
  (select jsonb_agg(jsonb_build_array(id,state,updated_at) order by id) from public.intake_items where patient_id=p_patient),
  (select max(created_at) from public.intake_activity where patient_id=p_patient),
  (select max(created_at) from public.message_outbox where patient_id=p_patient),
  (select max(created_at) from public.evidence where patient_id=p_patient),
  (select max(occurred_at) from public.care_events where patient_id=p_patient),
  (select jsonb_build_array(count(*),max(observed_at)) from public.glucose_observations where patient_id=p_patient),
  (select max(created_at) from public.patient_context_entries where patient_id=p_patient),
  (select max(created_at) from public.activity_corrections where patient_id=p_patient),
  (select jsonb_agg(jsonb_build_array(caregiver_id,granted,updated_at)) from private.caregiver_consents where patient_id=p_patient),
  (select reminders_enabled from public.patients where id=p_patient)) into value;
 return md5(value::text);
end$$;
create function public.workspace_revision(p_patient uuid) returns text language sql stable security invoker set search_path='' as $$select private.workspace_revision(p_patient);$$;
revoke all on function private.workspace_revision(uuid),public.workspace_revision(uuid) from public,anon;
grant execute on function private.workspace_revision(uuid),public.workspace_revision(uuid) to authenticated;
create function public.search_assigned_caseload(p_search text default '',p_filter text default 'all',p_offset integer default 0,p_limit integer default 12) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare source jsonb;result jsonb;begin
 if length(p_search)>100 or p_filter not in ('all','overdue','review','help') or p_offset<0 or p_offset>100000 or p_limit not between 1 and 50 then raise exception 'Invalid patient list request';end if;
 source:=private.assigned_caseload();
 with rows as(select value as p from jsonb_array_elements(source)), matches as(select p from rows where (p_search='' or strpos(lower((p->>'display_name')||' '||(p->>'patient_id')||' '||(p->>'language')),lower(trim(p_search)))>0) and (p_filter='all' or p_filter='overdue' and (p->>'overdue')::int>0 or p_filter='review' and (p->>'review_pending')::int>0 or p_filter='help' and (p->>'help_waiting')::int>0)), page as(select p from matches order by ((p->>'overdue')::int+(p->>'review_pending')::int+(p->>'help_waiting')::int) desc,p->>'display_name',p->>'patient_id' offset p_offset limit p_limit)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(p) from page),'[]'::jsonb),'matched',(select count(*) from matches),'totals',jsonb_build_object('patients',(select count(*) from rows),'overdue',coalesce((select sum((p->>'overdue')::int) from rows),0),'review',coalesce((select sum((p->>'review_pending')::int) from rows),0),'help',coalesce((select sum((p->>'help_waiting')::int) from rows),0))) into result;return result;
end$$;
revoke all on function public.search_assigned_caseload(text,text,integer,integer) from public,anon;
grant execute on function public.search_assigned_caseload(text,text,integer,integer) to authenticated;
