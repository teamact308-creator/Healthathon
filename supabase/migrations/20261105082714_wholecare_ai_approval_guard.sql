create or replace function private.authorize_ai_transfer(p_patient uuid,p_request uuid,p_operation text,p_kind text,p_version integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r text; p public.patients; existing public.ai_transfer_approvals;
begin
 perform pg_advisory_xact_lock(hashtextextended('ai:'||auth.uid()::text,0));
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
  raise exception 'This AI approval was already used. Review the transfer again.';
 else
  if (select count(*) from public.ai_transfer_approvals where actor_id=auth.uid() and created_at>now()-interval '1 day')>=100 then raise exception 'Daily AI allowance reached. Manual entry remains available.';end if;
  insert into public.ai_transfer_approvals(id,patient_id,actor_id,operation,payload_kind,privacy_version)
   values(p_request,p_patient,auth.uid(),p_operation,p_kind,p_version);
 end if;
 return jsonb_build_object('names',jsonb_build_array(p.display_name,(select display_name from public.profiles where id=auth.uid())));
end$$;
