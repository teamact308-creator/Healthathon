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

