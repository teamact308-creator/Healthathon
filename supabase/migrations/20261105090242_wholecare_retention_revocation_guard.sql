create or replace function public.claim_voice_retention(p_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare row record; items jsonb:='[]'; policy public.voice_retention_policies;
begin
 if length(coalesce(p_token,''))<64 or not exists(select 1 from vault.decrypted_secrets where name='wholecare_retention_token' and decrypted_secret=p_token) then raise exception 'Worker access denied' using errcode='42501';end if;
 for policy in select v.* from public.voice_retention_policies v join public.patients p on p.id=v.patient_id where v.days is not null and p.synthetic and (p.user_id=v.actor_id or exists(select 1 from private.memberships m where m.patient_id=v.patient_id and m.user_id=v.actor_id and m.role='clinician' and m.active)) for update of v skip locked loop
  for row in select o.name from storage.objects o where o.bucket_id='voice-notes'
   and split_part(o.name,'/',1)=policy.patient_id::text and coalesce(o.owner_id,o.owner::text)=policy.actor_id::text
   and o.created_at>=policy.effective_from and o.created_at<now()-make_interval(days=>policy.days)
   and not exists(select 1 from public.care_events e where e.details->>'audio_path'=o.name)
   order by o.created_at limit 50 loop
   perform pg_advisory_xact_lock(hashtextextended(row.name,0));
   if exists(select 1 from public.care_events e where e.details->>'audio_path'=row.name) then continue;end if;
   insert into private.voice_removals(path,patient_id,actor_id) values(row.name,policy.patient_id,policy.actor_id) on conflict(path) do nothing;
   update private.voice_removals set last_attempt_at=now(),attempts=attempts+1 where path=row.name and actor_id=policy.actor_id;
   items:=items||jsonb_build_array(jsonb_build_object('path',row.name));
   if jsonb_array_length(items)>=50 then return items;end if;
  end loop;
 end loop;
 return items;
end$$;

