-- Run inside a transaction after demo-multiple-patients.sql; caller rolls back.
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='clinician@wholecare.test'),true);
set local role authenticated;
do $$begin
 if jsonb_array_length(public.assigned_caseload())<>3 then raise exception 'Clinician caseload must include exactly three assigned fixtures';end if;
 if not exists(select 1 from public.patients where display_name='Ravi Mehta') then raise exception 'Assigned patient not readable';end if;
end$$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='patient@wholecare.test'),true);
set local role authenticated;
do $$begin
 if jsonb_array_length(public.assigned_caseload())<>0 then raise exception 'Patient received staff caseload';end if;
 if exists(select 1 from public.patients where display_name='Ravi Mehta') then raise exception 'Patient can read another patient';end if;
 if exists(select 1 from public.care_loops l join public.patients p on p.id=l.patient_id where p.display_name='Ravi Mehta') then raise exception 'Patient can read another history';end if;
end$$;
reset role;
update private.memberships set active=false where patient_id=(select id from public.patients where display_name='Ravi Mehta') and user_id=(select id from auth.users where email='clinician@wholecare.test');
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='clinician@wholecare.test'),true);
set local role authenticated;
do $$begin
 if jsonb_array_length(public.assigned_caseload())<>2 then raise exception 'Revoked patient remains in caseload';end if;
 if exists(select 1 from public.patients where display_name='Ravi Mehta') then raise exception 'Revoked patient remains readable';end if;
end$$;
reset role;
