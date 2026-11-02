create function private.operational_health(p_patient uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare result jsonb;begin
 if auth.uid() is null or coalesce(private.patient_role(p_patient),'') not in ('clinician','coordinator') then raise exception 'Assigned care team required' using errcode='42501';end if;
 select jsonb_build_object('checked_at',now(),
 'scheduler',(select jsonb_build_object('active',j.active,'last_status',r.status,'last_finished',r.end_time,'last_started',r.start_time) from cron.job j left join lateral(select status,end_time,start_time from cron.job_run_details where jobid=j.jobid order by runid desc limit 1) r on true where jobname='wholecare-plan-scheduler'),
 'channels',(select jsonb_agg(jsonb_build_object('channel',channel,'enabled',enabled) order by channel) from private.channel_gates),
 'pending_outbox',(select count(*) from public.message_outbox where patient_id=p_patient and delivery_status='pending'),
 'failed_outbox',(select count(*) from public.message_outbox where patient_id=p_patient and delivery_status='failed'),
 'uninvestigated_failures',(select count(*) from public.processing_events where patient_id=p_patient and resolved_at is null),
 'uncertain_deliveries',(select count(*) from public.delivery_jobs where patient_id=p_patient and state in ('reserved','unknown'))
 ) into result;return result;
end$$;
create function public.operational_health(p_patient uuid) returns jsonb language sql security invoker set search_path='' as $$select private.operational_health(p_patient);$$;
revoke all on function private.operational_health(uuid),public.operational_health(uuid) from public,anon;
grant execute on function private.operational_health(uuid),public.operational_health(uuid) to authenticated;
