begin;
do $$declare base uuid;operator uuid;patient_user uuid;request uuid:=gen_random_uuid();answer jsonb;role_name text;begin
 select p.id,m.user_id,p.user_id into base,operator,patient_user from public.patients p join private.memberships m on m.patient_id=p.id and m.role='clinician' and active where p.synthetic and p.user_id is not null limit 1;
 perform set_config('request.jwt.claim.sub',patient_user::text,true);
 begin perform public.reserve_demo_provision(request,base,'rehearsal');raise exception 'Patient provisioned identities';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',operator::text,true);answer:=public.reserve_demo_provision(request,base,'rehearsal');if answer->>'reserved'<>'true' then raise exception 'Reservation failed';end if;
 if public.reserve_demo_provision(request,base,'rehearsal')->>'reserved'<>'false' then raise exception 'Duplicate reservation accepted';end if;
 foreach role_name in array array['patient','clinician','coordinator','caregiver'] loop insert into auth.users(id,email) values(gen_random_uuid(),role_name||'-'||request||'@wholecare.test');end loop;
 begin perform public.complete_demo_provision(request);raise exception 'Authenticated caller linked identities';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('role','service_role')::text,true);answer:=public.complete_demo_provision(request);
 if not exists(select 1 from public.patients where id=(answer->>'patient_id')::uuid and synthetic and user_id is not null) then raise exception 'Synthetic patient link failed';end if;
 if (select count(*) from private.memberships where patient_id=(answer->>'patient_id')::uuid)<>4 then raise exception 'Expected separate persona assignments plus operator';end if;
 if public.complete_demo_provision(request)<>answer then raise exception 'Linking retry changed result';end if;
end$$;
rollback;
