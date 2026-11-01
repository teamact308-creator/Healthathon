-- Identity and role lookup derives exclusively from server-controlled memberships.
create function private.my_context() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('user_id',auth.uid(),'memberships',coalesce((
 select jsonb_agg(x) from (
 select p.id as patient_id,'patient'::text as role from public.patients p where auth.uid() is not null and p.user_id=auth.uid()
 union all
 select m.patient_id,m.role from private.memberships m where auth.uid() is not null and m.user_id=auth.uid() and m.active
 ) x),'[]'::jsonb)) where auth.uid() is not null;
$$;
create function public.my_context() returns jsonb language sql stable security invoker set search_path='' as $$select private.my_context();$$;
revoke all on function private.my_context(),public.my_context() from public,anon;
grant execute on function private.my_context(),public.my_context() to authenticated;

create function private.demo_consent(p_patient uuid,p_granted boolean,p_event_key uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare caregiver uuid;
begin
 if auth.uid() is null or private.patient_role(p_patient) is distinct from 'patient' then raise exception 'Only assigned patient can change consent' using errcode='42501'; end if;
 select user_id into caregiver from private.memberships where patient_id=p_patient and role='caregiver' and active order by user_id limit 1;
 if caregiver is null then raise exception 'No assigned caregiver'; end if;
 return private.set_consent(p_patient,caregiver,p_granted,p_event_key);
end $$;
create function public.demo_caregiver_consent(p_patient uuid,p_granted boolean,p_event_key uuid) returns boolean language sql security invoker set search_path='' as $$select private.demo_consent(p_patient,p_granted,p_event_key);$$;
revoke all on function private.demo_consent(uuid,boolean,uuid),public.demo_caregiver_consent(uuid,boolean,uuid) from public,anon;
grant execute on function private.demo_consent(uuid,boolean,uuid),public.demo_caregiver_consent(uuid,boolean,uuid) to authenticated;
