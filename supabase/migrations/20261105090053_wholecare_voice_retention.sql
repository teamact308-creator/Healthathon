create extension if not exists pg_net with schema extensions;

create table public.voice_retention_policies(
 patient_id uuid not null references public.patients(id),
 actor_id uuid not null references auth.users(id),
 days integer check(days in (1,7,30)),
 effective_from timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(patient_id,actor_id)
);
alter table public.voice_retention_policies enable row level security;
revoke all on public.voice_retention_policies from public,anon,authenticated;
grant select on public.voice_retention_policies to authenticated;
create policy voice_retention_read on public.voice_retention_policies for select to authenticated
 using(actor_id=auth.uid() and private.patient_role(patient_id) in ('patient','clinician'));

alter table private.voice_removals add column removed_at timestamptz;
alter table private.voice_removals add column last_attempt_at timestamptz;
alter table private.voice_removals add column attempts integer not null default 0;

create function private.voice_retention_preview(p_patient uuid,p_days integer,p_existing boolean default false)
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
 ),'policy_days',policy.days,'effective_from',policy.effective_from);
end$$;
create function public.voice_retention_preview(p_patient uuid,p_days integer,p_existing boolean default false)
returns jsonb language sql security invoker set search_path='' as $$select private.voice_retention_preview(p_patient,p_days,p_existing);$$;

create function private.set_voice_retention(p_patient uuid,p_days integer,p_existing boolean default false)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or coalesce(private.patient_role(p_patient),'') not in ('patient','clinician') or not exists(select 1 from public.patients where id=p_patient and synthetic) then raise exception 'Demo recording access required' using errcode='42501';end if;
 if p_days is not null and p_days not in (1,7,30) then raise exception 'Choose 1, 7 or 30 days';end if;
 insert into public.voice_retention_policies(patient_id,actor_id,days,effective_from)
  values(p_patient,auth.uid(),p_days,case when p_existing then '-infinity'::timestamptz else now() end)
 on conflict(patient_id,actor_id) do update set days=excluded.days,effective_from=case when voice_retention_policies.days is not distinct from excluded.days and not p_existing then voice_retention_policies.effective_from else excluded.effective_from end,updated_at=now();
end$$;
create function public.set_voice_retention(p_patient uuid,p_days integer,p_existing boolean default false)
returns void language sql security invoker set search_path='' as $$select private.set_voice_retention(p_patient,p_days,p_existing);$$;
revoke all on function private.voice_retention_preview(uuid,integer,boolean),public.voice_retention_preview(uuid,integer,boolean),private.set_voice_retention(uuid,integer,boolean),public.set_voice_retention(uuid,integer,boolean) from public,anon;
grant execute on function private.voice_retention_preview(uuid,integer,boolean),public.voice_retention_preview(uuid,integer,boolean),private.set_voice_retention(uuid,integer,boolean),public.set_voice_retention(uuid,integer,boolean) to authenticated;

create function public.install_voice_retention_worker(p_token text,p_url text,p_anon text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare job bigint;
begin
 if p_url<>'https://gylnitduoasmybadblcp.supabase.co' or length(p_token)<64 or p_anon not like 'eyJ%' then raise exception 'Invalid worker configuration';end if;
 if not exists(select 1 from vault.secrets where name='wholecare_retention_token') then
  perform vault.create_secret(p_token,'wholecare_retention_token');
  perform vault.create_secret(p_anon,'wholecare_retention_anon');
 end if;
 select cron.schedule('wholecare-voice-retention','15 2 * * *',$job$
 select net.http_post(
  url:='https://gylnitduoasmybadblcp.supabase.co/functions/v1/voice-retention',
  headers:=jsonb_build_object('Content-Type','application/json',
   'apikey',(select decrypted_secret from vault.decrypted_secrets where name='wholecare_retention_anon'),
   'Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='wholecare_retention_anon'),
   'x-retention-token',(select decrypted_secret from vault.decrypted_secrets where name='wholecare_retention_token')),
  body:='{}'::jsonb
 );$job$) into job;
 return jsonb_build_object('scheduled',true,'job_id',job);
end$$;
revoke all on function public.install_voice_retention_worker(text,text,text) from public,anon,authenticated;
grant execute on function public.install_voice_retention_worker(text,text,text) to service_role;

create function public.claim_voice_retention(p_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare row record; items jsonb:='[]'; policy public.voice_retention_policies;
begin
 if length(coalesce(p_token,''))<64 or not exists(select 1 from vault.decrypted_secrets where name='wholecare_retention_token' and decrypted_secret=p_token) then raise exception 'Worker access denied' using errcode='42501';end if;
 for policy in select v.* from public.voice_retention_policies v join public.patients p on p.id=v.patient_id where v.days is not null and p.synthetic for update of v skip locked loop
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
create function public.finish_voice_retention(p_token text,p_path text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if length(coalesce(p_token,''))<64 or not exists(select 1 from vault.decrypted_secrets where name='wholecare_retention_token' and decrypted_secret=p_token) then raise exception 'Worker access denied' using errcode='42501';end if;
 update private.voice_removals set removed_at=now() where path=p_path and not exists(select 1 from storage.objects where bucket_id='voice-notes' and name=p_path);
end$$;
revoke all on function public.claim_voice_retention(text),public.finish_voice_retention(text,text) from public,anon,authenticated;
grant execute on function public.claim_voice_retention(text),public.finish_voice_retention(text,text) to service_role;
