create function private.request_activity_help(p_loop uuid,p_text text,p_event uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare activity record; existing public.intake_items; result uuid; note text:=trim(coalesce(p_text,''));
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_event is null or length(note) not between 1 and 1000 then raise exception 'Enter a help request of up to 1,000 characters'; end if;
 select l.patient_id,l.state,l.due_at,p.active,p.status,i.label into activity
 from public.care_loops l join public.care_plan_items i on i.id=l.item_id
 join public.care_plans p on p.id=i.plan_id where l.id=p_loop for update of l;
 if not found or private.patient_role(activity.patient_id) is distinct from 'patient' then
  raise exception 'Activity not accessible' using errcode='42501';
 end if;
 select * into existing from public.intake_items where created_by=auth.uid() and event_key=p_event;
 if found then
  if existing.loop_id is distinct from p_loop or existing.source_text is distinct from note or existing.source_path is not null then
   raise exception 'Request key reused with different input';
  end if;
  return existing.id;
 end if;
 if not activity.active or activity.status<>'confirmed' or activity.state not in ('DUE','UNCONFIRMED') or activity.due_at>now() then
  raise exception 'Choose an open activity that is due';
 end if;
 if exists(select 1 from public.intake_items where loop_id=p_loop and source_path is null and state='unmatched' and label like 'Help request: %') then
  raise exception 'A help request for this activity is already waiting for the care team';
 end if;
 result:=private.submit_intake(activity.patient_id,'Help request: '||left(activity.label,186),note,null,p_event);
 update public.intake_items set loop_id=p_loop where id=result and patient_id=activity.patient_id and loop_id is null;
 return result;
end$$;
create function public.request_activity_help(p_loop uuid,p_text text,p_event uuid)
returns uuid language sql security invoker set search_path='' as $$
select private.request_activity_help(p_loop,p_text,p_event);
$$;
revoke all on function private.request_activity_help(uuid,text,uuid) from public,anon;
revoke all on function public.request_activity_help(uuid,text,uuid) from public,anon;
grant execute on function private.request_activity_help(uuid,text,uuid) to authenticated;
grant execute on function public.request_activity_help(uuid,text,uuid) to authenticated;
