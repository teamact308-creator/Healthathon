-- Patient-scoped operational overview. No cross-clinic or global patient access.
create function private.assigned_caseload() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(row order by row.display_name,row.patient_id),'[]'::jsonb) from (
 select p.id as patient_id,p.display_name,p.language,p.timezone,
 (select m.role from private.memberships m where m.patient_id=p.id and m.user_id=auth.uid() and m.active and m.role in ('clinician','coordinator') order by m.role limit 1) as role,
 (select count(*) from public.care_loops l join public.care_plan_items i on i.id=l.item_id join public.care_plans cp on cp.id=i.plan_id where l.patient_id=p.id and cp.active and cp.status='confirmed' and l.state in ('DUE','UNCONFIRMED') and l.due_at<=now()) as due,
 (select count(*) from public.care_loops l join public.care_plan_items i on i.id=l.item_id join public.care_plans cp on cp.id=i.plan_id where l.patient_id=p.id and cp.active and cp.status='confirmed' and l.state in ('DUE','UNCONFIRMED') and l.due_at<now()-interval '30 minutes') as overdue,
 (select count(*) from public.care_loops l where l.patient_id=p.id and l.state='REVIEW_PENDING') as review_pending,
 (select count(*) from public.intake_items q where q.patient_id=p.id and q.state not in ('resolved','dismissed') and q.source_path is null and q.loop_id is not null and q.label like 'Help request: %' and coalesce((select a.action from public.intake_activity a where a.intake_id=q.id and a.action in ('help_reply','help_patient_reply','help_resolve','acknowledge','dismiss') order by a.created_at desc,a.id desc limit 1),'')<>'help_reply') as help_waiting
 from public.patients p where auth.uid() is not null and exists(select 1 from private.memberships m where m.patient_id=p.id and m.user_id=auth.uid() and m.active and m.role in ('clinician','coordinator'))
 ) row;
$$;
create function public.assigned_caseload() returns jsonb language sql stable security invoker set search_path='' as $$select private.assigned_caseload();$$;
revoke all on function private.assigned_caseload(),public.assigned_caseload() from public,anon;
grant execute on function private.assigned_caseload(),public.assigned_caseload() to authenticated;
create index if not exists intake_activity_thread_latest on public.intake_activity(intake_id,created_at desc,id desc);
