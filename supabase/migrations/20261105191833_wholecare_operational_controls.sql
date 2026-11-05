create function public.caseload_revision() returns text language sql stable security invoker set search_path='' as $$select md5(private.assigned_caseload()::text);$$;
revoke all on function public.caseload_revision() from public,anon;grant execute on function public.caseload_revision() to authenticated;
create function private.valid_local_clock(p_local timestamp,p_timezone text) returns boolean language sql stable set search_path='' as $$
 select (p_local at time zone p_timezone) at time zone p_timezone=p_local and not exists(select 1 from unnest(array[interval '-2 hours',interval '-1 hour',interval '-30 minutes',interval '30 minutes',interval '1 hour',interval '2 hours']) delta where ((p_local at time zone p_timezone)+delta) at time zone p_timezone=p_local);
$$;
create function private.guard_schedule_clock() returns trigger language plpgsql set search_path='' as $$
declare zone text;cadence text;local_date date;clock time;begin
 select p.timezone,i.cadence into zone,cadence from public.care_plan_items i join public.care_plans p on p.id=i.plan_id where i.id=new.item_id;
 for local_date in select day::date from generate_series(new.start_date::timestamp,new.end_date::timestamp,interval '1 day') day where cadence<>'weekly' or extract(dow from day)::int=any(new.weekdays) loop
  foreach clock in array new.times loop if not private.valid_local_clock(local_date+clock,zone) then raise exception 'This schedule includes an ambiguous or nonexistent local clock time. Choose an explicit reviewed time or handle the transition manually.';end if;end loop;
 end loop;return new;
end$$;
create trigger safe_schedule_clock before insert or update on public.plan_schedules for each row execute function private.guard_schedule_clock();
revoke all on function private.valid_local_clock(timestamp,text),private.guard_schedule_clock() from public,anon,authenticated;
-- Narrow service-only transport repository. No gate/enrollment mutation or job activation operation.
create function public.delivery_worker_rpc(p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare answer jsonb;begin
 if auth.jwt()->>'role' is distinct from 'service_role' then raise exception 'Service only' using errcode='42501';end if;
 case p_action
 when 'status' then select jsonb_build_object('gates',(select jsonb_agg(jsonb_build_object('channel',channel,'enabled',enabled)) from private.channel_gates),'uncertain',(select count(*) from public.delivery_jobs where state in ('reserved','unknown')),'pending',(select count(*) from public.delivery_jobs where state='pending')) into answer;
 when 'candidates' then select coalesce(jsonb_agg(j),'[]'::jsonb) into answer from(select j.id,j.version,j.channel from public.delivery_jobs j join private.channel_gates g on g.channel=j.channel and g.enabled where j.state='pending' and j.not_before<=now() order by j.not_before,j.id limit 25) j;
 when 'claim' then answer:=private.claim_delivery((p_data->>'job_id')::uuid,(p_data->>'version')::int);
 when 'result' then perform private.delivery_result((p_data->>'job_id')::uuid,p_data->>'event_key',p_data->>'status',p_data->>'provider_id');answer:='{"saved":true}';
 when 'provider' then select to_jsonb(j) into answer from(select id,channel,provider_id from public.delivery_jobs where provider_id=p_data->>'provider_id') j;
 when 'recipient' then select jsonb_build_object('address',e.recipient_reference) into answer from private.channel_enrollments e join private.channel_gates g on g.channel=e.channel and g.enabled where e.patient_id=(p_data->>'patient_id')::uuid and e.channel=p_data->>'channel' and e.consented and e.verified_at is not null;
 else raise exception 'Unsupported transport operation';end case;
 return answer;
end$$;
revoke all on function public.delivery_worker_rpc(text,jsonb) from public,anon,authenticated;grant execute on function public.delivery_worker_rpc(text,jsonb) to service_role;
