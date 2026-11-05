create or replace function private.voice_retention_preview(p_patient uuid,p_days integer,p_existing boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare effective timestamptz:=case when p_existing then '-infinity'::timestamptz else now() end; policy public.voice_retention_policies;
begin
 if auth.uid() is null or coalesce(private.patient_role(p_patient),'') not in ('patient','clinician') then raise exception 'Recording access denied' using errcode='42501';end if;
 if p_days is not null and p_days not in (1,7,30) then raise exception 'Choose 1, 7 or 30 days';end if;
 select * into policy from public.voice_retention_policies where patient_id=p_patient and actor_id=auth.uid();
 if not p_existing and policy.days=p_days then effective:=policy.effective_from;end if;
 return jsonb_build_object('eligible',(
  select count(*) from storage.objects o where bucket_id='voice-notes' and split_part(name,'/',1)=p_patient::text
   and coalesce(owner_id,owner::text)=auth.uid()::text and created_at>=effective
   and p_days is not null and created_at<now()-make_interval(days=>p_days)
   and not exists(select 1 from public.care_events e where e.details->>'audio_path'=o.name)
 ),'worker_scheduled',exists(select 1 from cron.job where jobname='wholecare-voice-retention' and active),'policy_days',policy.days,'effective_from',policy.effective_from);
end$$;
