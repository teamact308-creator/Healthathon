begin;
do $$declare status jsonb;begin
 if private.valid_local_clock(timestamp '2027-03-14 02:30','America/New_York') then raise exception 'Nonexistent DST time accepted';end if;
 if private.valid_local_clock(timestamp '2027-11-07 01:30','America/New_York') then raise exception 'Ambiguous DST time accepted';end if;
 if not private.valid_local_clock(timestamp '2027-03-14 08:00','America/New_York') then raise exception 'Normal DST day time rejected';end if;
 if not private.valid_local_clock(timestamp '2027-03-14 02:30','Asia/Kolkata') then raise exception 'Valid India clock rejected';end if;
 perform set_config('request.jwt.claims','{"role":"authenticated"}',true);
 begin perform public.delivery_worker_rpc('status');raise exception 'Authenticated transport access';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);status:=public.delivery_worker_rpc('status');
 if exists(select 1 from jsonb_array_elements(status->'gates') g where (g->>'enabled')::boolean) then raise exception 'Live channel unexpectedly enabled';end if;
 if public.delivery_worker_rpc('candidates')<>'[]'::jsonb then raise exception 'Disabled channels returned dispatch candidates';end if;
end$$;
rollback;
