create table public.ai_transfer_approvals (
 id uuid primary key,
 patient_id uuid not null references public.patients(id),
 actor_id uuid not null references auth.users(id),
 operation text not null check(operation in ('transcription','interpretation','activity_suggestions','plan_extraction','visit_selection')),
 payload_kind text not null check(payload_kind in ('text','audio','document')),
 privacy_version integer not null check(privacy_version=1),
 created_at timestamptz not null default now()
);
alter table public.ai_transfer_approvals enable row level security;
revoke all on public.ai_transfer_approvals from public,anon,authenticated;
grant select on public.ai_transfer_approvals to authenticated;
create policy ai_approval_read on public.ai_transfer_approvals for select to authenticated
 using (actor_id=auth.uid() and private.patient_role(patient_id) in ('patient','clinician'));

create function private.authorize_ai_transfer(p_patient uuid,p_request uuid,p_operation text,p_kind text,p_version integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r text; p public.patients; existing public.ai_transfer_approvals;
begin
 select * into p from public.patients where id=p_patient for update;
 r:=private.patient_role(p_patient);
 if auth.uid() is null or r is null or r not in ('patient','clinician') or not coalesce(p.synthetic,false) then
  raise exception 'AI requires an assigned patient or clinician in the demo workspace' using errcode='42501';
 end if;
 if p_version is distinct from 1 or p_request is null then raise exception 'Review the AI transfer first' using errcode='42501';end if;
 if p_operation not in ('transcription','interpretation','activity_suggestions','plan_extraction','visit_selection') or p_kind not in ('text','audio','document') then raise exception 'Invalid AI operation';end if;
 if p_operation='plan_extraction' and r<>'clinician' or p_operation='visit_selection' and r<>'patient' then raise exception 'AI operation not permitted' using errcode='42501';end if;
 select * into existing from public.ai_transfer_approvals where id=p_request;
 if found then
  if existing.patient_id<>p_patient or existing.actor_id<>auth.uid() or existing.operation<>p_operation or existing.payload_kind<>p_kind then raise exception 'AI request key mismatch';end if;
 else
  if (select count(*) from public.ai_transfer_approvals where actor_id=auth.uid() and created_at>now()-interval '1 day')>=100 then raise exception 'Daily AI allowance reached. Manual entry remains available.';end if;
  insert into public.ai_transfer_approvals(id,patient_id,actor_id,operation,payload_kind,privacy_version)
   values(p_request,p_patient,auth.uid(),p_operation,p_kind,p_version);
 end if;
 return jsonb_build_object('names',jsonb_build_array(p.display_name,(select display_name from public.profiles where id=auth.uid())));
end$$;
create function public.authorize_ai_transfer(p_patient uuid,p_request uuid,p_operation text,p_kind text,p_version integer)
returns jsonb language sql security invoker set search_path='' as $$select private.authorize_ai_transfer(p_patient,p_request,p_operation,p_kind,p_version);$$;
revoke all on function private.authorize_ai_transfer(uuid,uuid,text,text,integer),public.authorize_ai_transfer(uuid,uuid,text,text,integer) from public,anon;
grant execute on function private.authorize_ai_transfer(uuid,uuid,text,text,integer),public.authorize_ai_transfer(uuid,uuid,text,text,integer) to authenticated;

alter policy voice_read on storage.objects using(bucket_id='voice-notes' and private.patient_role((storage.foldername(name))[1]::uuid) in ('patient','clinician'));
alter policy plan_document_read on storage.objects using(bucket_id='plan-documents' and private.patient_role((storage.foldername(name))[1]::uuid) in ('patient','clinician'));
