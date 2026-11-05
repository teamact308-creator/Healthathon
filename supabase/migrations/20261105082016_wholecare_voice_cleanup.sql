create table private.voice_removals (
 path text primary key, patient_id uuid not null references public.patients(id),
 actor_id uuid not null references auth.users(id), created_at timestamptz not null default now()
);
alter table private.voice_removals enable row level security;
revoke all on private.voice_removals from public,anon,authenticated;

create function private.guard_voice_reference() returns trigger
language plpgsql security definer set search_path='' as $$
declare path text:=nullif(new.details->>'audio_path','');
begin
 if path is null then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended(path,0));
 if exists(select 1 from private.voice_removals r where r.path=path) then
  raise exception 'Recording was removed. Record again or save using text only.';
 end if;
 return new;
end$$;
revoke all on function private.guard_voice_reference() from public,anon,authenticated;
create trigger voice_reference_retention before insert or update of details on public.care_events
 for each row execute function private.guard_voice_reference();

create function private.unused_voice_recordings(p_patient uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or coalesce(private.patient_role(p_patient),'') not in ('patient','clinician') then raise exception 'Recording access denied' using errcode='42501';end if;
 return (select coalesce(jsonb_agg(to_jsonb(f)),'[]'::jsonb) from (
  select o.name as path,o.created_at,
   exists(select 1 from public.care_events e where e.patient_id=p_patient and e.details->>'audio_path'=o.name) as linked
  from storage.objects o where o.bucket_id='voice-notes' and split_part(o.name,'/',1)=p_patient::text
   and coalesce(o.owner_id,o.owner::text)=auth.uid()::text
  order by o.created_at desc limit 100
 ) f);
end$$;
create function public.unused_voice_recordings(p_patient uuid) returns jsonb
language sql security invoker set search_path='' as $$select private.unused_voice_recordings(p_patient);$$;

create function private.prepare_voice_removal(p_patient uuid,p_path text) returns text
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or coalesce(private.patient_role(p_patient),'') not in ('patient','clinician') or split_part(p_path,'/',1)<>p_patient::text then raise exception 'Recording access denied' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_path,0));
 if exists(select 1 from private.voice_removals where path=p_path and actor_id=auth.uid() and patient_id=p_patient) then return p_path;end if;
 if not exists(select 1 from storage.objects o where o.bucket_id='voice-notes' and o.name=p_path and coalesce(o.owner_id,o.owner::text)=auth.uid()::text) then raise exception 'Only your uploaded recordings can be removed' using errcode='42501';end if;
 if exists(select 1 from public.care_events e where e.patient_id=p_patient and e.details->>'audio_path'=p_path) then raise exception 'This recording is attached to saved activity';end if;
 insert into private.voice_removals(path,patient_id,actor_id) values(p_path,p_patient,auth.uid());
 return p_path;
end$$;
create function public.prepare_voice_removal(p_patient uuid,p_path text) returns text
language sql security invoker set search_path='' as $$select private.prepare_voice_removal(p_patient,p_path);$$;

create function private.voice_removal_allowed(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from private.voice_removals where path=p_path and actor_id=auth.uid() and private.patient_role(patient_id) in ('patient','clinician'));
$$;
revoke all on function private.voice_removal_allowed(text) from public,anon;
grant execute on function private.voice_removal_allowed(text) to authenticated;
create policy voice_remove on storage.objects for delete to authenticated
 using(bucket_id='voice-notes' and private.voice_removal_allowed(name));

revoke all on function private.unused_voice_recordings(uuid),public.unused_voice_recordings(uuid),private.prepare_voice_removal(uuid,text),public.prepare_voice_removal(uuid,text) from public,anon;
grant execute on function private.unused_voice_recordings(uuid),public.unused_voice_recordings(uuid),private.prepare_voice_removal(uuid,text),public.prepare_voice_removal(uuid,text) to authenticated;
