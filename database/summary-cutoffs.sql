create or replace function private.operational_snapshot(p_patient uuid,p_from timestamptz,p_to timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$declare result jsonb;begin
 if auth.uid() is null or private.patient_role(p_patient) is null or private.patient_role(p_patient) not in ('clinician','coordinator') then raise exception 'Assigned care team required' using errcode='42501';end if;
 if p_from is null or p_to is null or p_to<=p_from or p_to-p_from>interval '91 days' or p_to>now()+interval '2 days' then raise exception 'Choose a valid period of up to 90 days';end if;
 select jsonb_build_object('from',p_from,'to',p_to,'generated_at',now(),
 'plans',(select coalesce(jsonb_agg(x),'[]') from public.care_plans x where patient_id=p_patient),
 'items',(select coalesce(jsonb_agg(x),'[]') from public.care_plan_items x where patient_id=p_patient),
 'loops',(select coalesce(jsonb_agg(x),'[]') from public.care_loops x where patient_id=p_patient and ((due_at>=p_from and due_at<p_to) or (due_at<p_to and state not in ('CLOSED','CANCELLED')))),
 'events',(select coalesce(jsonb_agg(x),'[]') from public.care_events x where patient_id=p_patient and coalesce((details->>'recorded_at')::timestamptz,occurred_at)>=p_from and coalesce((details->>'recorded_at')::timestamptz,occurred_at)<p_to),
 'audit',(select coalesce(jsonb_agg(x),'[]') from public.audit_events x where patient_id=p_patient and created_at>=p_from and created_at<p_to),
 'planActivity',(select coalesce(jsonb_agg(x),'[]') from public.plan_activity x where patient_id=p_patient and created_at>=p_from and created_at<p_to),
 'evidence',(select coalesce(jsonb_agg(x),'[]') from public.evidence x where patient_id=p_patient),
 'observations',(select coalesce(jsonb_agg(x),'[]') from (select observed_at,value,unit from public.glucose_observations where patient_id=p_patient and observed_at<least(p_to,now()) order by observed_at desc limit 1) x),
 'failures',(select coalesce(jsonb_agg(x),'[]') from public.processing_events x where patient_id=p_patient and created_at>=p_from and created_at<p_to),
 'intake',(select coalesce(jsonb_agg(x),'[]') from public.intake_items x where patient_id=p_patient and state in ('unmatched','matched')),
 'context',(select coalesce(jsonb_agg(x),'[]') from public.patient_context_entries x where patient_id=p_patient),
 'policy',(select to_jsonb(x) from public.workflow_policy_versions x where patient_id=p_patient order by created_at desc,id desc limit 1),
 'corrections',(select coalesce(jsonb_agg(x),'[]') from public.activity_corrections x where patient_id=p_patient and created_at>=p_from and created_at<p_to),
 'delivery',(select coalesce(jsonb_agg(x),'[]') from public.delivery_jobs x where patient_id=p_patient)) into result;
 return result;
end$$;
