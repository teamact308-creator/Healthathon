-- Assigned caregiver identities/consent for the patient and assigned clinical team only.
create function private.support_context(p_patient uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or private.patient_role(p_patient) is null then raise exception 'Assigned care access required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',m.user_id,'name',p.display_name,'granted',coalesce(c.granted,false)))
 from private.memberships m join public.profiles p on p.id=m.user_id
 left join private.caregiver_consents c on c.patient_id=m.patient_id and c.caregiver_id=m.user_id
 where m.patient_id=p_patient and m.role='caregiver' and m.active),'[]'::jsonb);
end $$;
create function public.caregiver_support_context(p_patient uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select private.support_context(p_patient);$$;
revoke all on function private.support_context(uuid),public.caregiver_support_context(uuid) from public,anon;
grant execute on function private.support_context(uuid),public.caregiver_support_context(uuid) to authenticated;
