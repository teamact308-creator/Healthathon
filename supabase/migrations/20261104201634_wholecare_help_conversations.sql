create function private.update_help_thread(p_request uuid,p_action text,p_text text,p_event uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare item public.intake_items; actor uuid:=auth.uid(); actor_role text; owner uuid; previous public.intake_activity;
 note text:=trim(coalesce(p_text,'')); event_action text;
begin
 if actor is null or p_event is null then raise exception 'Sign in and provide a request key' using errcode='42501'; end if;
 select * into item from public.intake_items where id=p_request for update;
 actor_role:=private.patient_role(item.patient_id);
 if actor_role is null or item.loop_id is null or item.source_path is not null or item.label not like 'Help request: %' then
  raise exception 'Help request not accessible' using errcode='42501';
 end if;
 if p_action='reply' and actor_role='patient' then event_action:='help_patient_reply';
 elsif actor_role in ('clinician','coordinator') and p_action in ('claim','reply','resolve') then event_action:='help_'||p_action;
 else raise exception 'Help action not permitted' using errcode='42501'; end if;
 if p_action='claim' then select coalesce((select display_name from public.profiles where id=actor),'Care team') into note;end if;
 if p_action='resolve' and note='' then note:='Care team marked the request resolved.';end if;
 if length(note) not between 1 and 2000 then raise exception 'Enter a message of up to 2,000 characters';end if;
 select * into previous from public.intake_activity where id=p_event;
 if found then
  if previous.intake_id=p_request and previous.actor_id=actor and previous.action=event_action and previous.reason=note then return p_request;end if;
  raise exception 'Request key reused with different input';
 end if;
 if item.state in ('resolved','dismissed') then raise exception 'This request is closed';end if;
 select actor_id into owner from public.intake_activity where intake_id=p_request and action='help_claim' order by created_at desc,id desc limit 1;
 if actor_role in ('clinician','coordinator') then
  if p_action='claim' and owner is not null then raise exception 'Someone has already picked up this request';end if;
  if p_action<>'claim' and owner is distinct from actor then raise exception 'Pick up the request before replying or resolving';end if;
 end if;
 insert into public.intake_activity(id,patient_id,intake_id,actor_id,action,reason) values(p_event,item.patient_id,p_request,actor,event_action,note);
 update public.intake_items set state=case when p_action='resolve' then 'resolved' else state end,updated_at=now() where id=p_request;
 return p_request;
end$$;
create function public.update_help_thread(p_request uuid,p_action text,p_text text,p_event uuid)
returns uuid language sql security invoker set search_path='' as $$select private.update_help_thread(p_request,p_action,p_text,p_event);$$;
revoke all on function private.update_help_thread(uuid,text,text,uuid) from public,anon;
revoke all on function public.update_help_thread(uuid,text,text,uuid) from public,anon;
grant execute on function private.update_help_thread(uuid,text,text,uuid) to authenticated;
grant execute on function public.update_help_thread(uuid,text,text,uuid) to authenticated;
