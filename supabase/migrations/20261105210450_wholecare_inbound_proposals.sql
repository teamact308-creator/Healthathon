create table public.message_proposals(id uuid primary key default gen_random_uuid(),patient_id uuid not null references public.patients,channel text not null check(channel in ('whatsapp','sms')),provider_id text not null unique,source_text text not null check(length(source_text) between 1 and 2000),proposal jsonb not null,loop_id uuid,state text not null default 'pending' check(state in ('pending','confirmed','discarded')),confirmed_status text,event_key uuid,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),foreign key(loop_id,patient_id) references public.care_loops(id,patient_id));
alter table public.message_proposals enable row level security;revoke all on public.message_proposals from public,anon,authenticated;grant select on public.message_proposals to authenticated;
create policy assigned_proposal_read on public.message_proposals for select to authenticated using(private.patient_role(patient_id) in ('patient','clinician','coordinator'));
create index message_proposals_patient_state on public.message_proposals(patient_id,state,created_at);
create function public.stage_inbound_proposal(p_channel text,p_sender text,p_provider text,p_text text,p_proposal jsonb,p_reply_provider text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare patient uuid;matches integer;existing public.message_proposals;selected uuid;result uuid;begin
 if auth.jwt()->>'role' is distinct from 'service_role' then raise exception 'Verified backend only' using errcode='42501';end if;
 if coalesce(p_channel,'') not in ('whatsapp','sms') or coalesce(p_provider,'')!~'^(SM|MM)[a-fA-F0-9]{32}$' or length(trim(coalesce(p_text,''))) not between 1 and 2000 then raise exception 'Invalid inbound request';end if;
 select count(*),(array_agg(patient_id order by patient_id))[1] into matches,patient from private.channel_enrollments where channel=p_channel and recipient_reference=p_sender and verified_at is not null;
 if upper(trim(p_text))='STOP' then
  perform 1 from public.patients p where p.id in(select patient_id from private.channel_enrollments where channel=p_channel and recipient_reference=p_sender and verified_at is not null) order by p.id for update;
  update private.channel_enrollments set consented=false where channel=p_channel and recipient_reference=p_sender and verified_at is not null;
  return jsonb_build_object('stopped',true);
 end if;
 if matches<>1 then raise exception 'Verified unambiguous enrollment required' using errcode='42501';end if;
 perform 1 from public.patients where id=patient for update;
 if not exists(select 1 from private.channel_gates where channel=p_channel and enabled) or not exists(select 1 from private.channel_enrollments where patient_id=patient and channel=p_channel and recipient_reference=p_sender and consented and verified_at is not null) then raise exception 'Channel or consent unavailable' using errcode='42501';end if;
 select * into existing from public.message_proposals where provider_id=p_provider;
 if found then if existing.patient_id<>patient or existing.channel<>p_channel or existing.source_text<>trim(p_text) then raise exception 'Provider request conflict';end if;return jsonb_build_object('proposal_id',existing.id,'duplicate',true);end if;
 if coalesce(p_proposal->>'kind','') not in ('activity','report','clarify') then raise exception 'Review proposal required';end if;
 if p_proposal->>'kind'='activity' and not coalesce(((p_proposal->>'domain'='medication' and p_proposal->>'status' in ('taken','missed','delayed')) or (p_proposal->>'domain'='meals' and p_proposal->>'status'='meal_logged') or (p_proposal->>'domain'='glucose' and p_proposal->>'status'='availability_confirmed')),false) then raise exception 'Invalid activity proposal';end if;
 if p_reply_provider is not null then
  select o.loop_id into selected from public.delivery_jobs j join public.message_outbox o on o.id=j.outbox_id join public.care_loops l on l.id=o.loop_id where j.provider_id=p_reply_provider and j.patient_id=patient and j.channel=p_channel and l.patient_id=patient and l.state in ('DUE','UNCONFIRMED') and l.due_at<=now();
 end if;
 insert into public.message_proposals(patient_id,channel,provider_id,source_text,proposal,loop_id) values(patient,p_channel,p_provider,trim(p_text),p_proposal,selected) returning id into result;
 return jsonb_build_object('proposal_id',result,'requires_confirmation',true,'matched',selected is not null);
end$$;
revoke all on function public.stage_inbound_proposal(text,text,text,text,jsonb,text) from public,anon,authenticated;grant execute on function public.stage_inbound_proposal(text,text,text,text,jsonb,text) to service_role;
create function private.review_message_proposal(p_id uuid,p_action text,p_loop uuid,p_status text,p_note text,p_event uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare proposal public.message_proposals;begin
 select * into proposal from public.message_proposals where id=p_id for update;
 if not found or auth.uid() is null or private.patient_role(proposal.patient_id) is distinct from 'patient' then raise exception 'Assigned patient confirmation required' using errcode='42501';end if;
 if p_event is null or coalesce(p_action,'') not in ('confirm','discard') or length(trim(coalesce(p_note,''))) not between 1 and 2000 then raise exception 'Reviewed note and event key required';end if;
 if proposal.state<>'pending' then if proposal.event_key=p_event and ((p_action='discard' and proposal.state='discarded') or (p_action='confirm' and proposal.state='confirmed' and proposal.loop_id=p_loop and proposal.confirmed_status=p_status)) then return p_id;end if;raise exception 'Proposal already reviewed';end if;
 if p_action='confirm' then
  if not exists(select 1 from public.care_loops where id=p_loop and patient_id=proposal.patient_id) then raise exception 'Choose this patient activity';end if;
  perform public.log_care_activity(p_loop,p_status,jsonb_build_object('note',trim(p_note),'source','confirmed_message','message_proposal',p_id,'original_text',proposal.source_text),p_event);
 end if;
 update public.message_proposals set state=case when p_action='confirm' then 'confirmed' else 'discarded' end,loop_id=case when p_action='confirm' then p_loop else loop_id end,confirmed_status=p_status,event_key=p_event,updated_at=now() where id=p_id;return p_id;
end$$;
create function public.review_message_proposal(p_id uuid,p_action text,p_loop uuid,p_status text,p_note text,p_event uuid) returns uuid language sql security invoker set search_path='' as $$select private.review_message_proposal(p_id,p_action,p_loop,p_status,p_note,p_event);$$;
revoke all on function private.review_message_proposal(uuid,text,uuid,text,text,uuid),public.review_message_proposal(uuid,text,uuid,text,text,uuid) from public,anon;
grant execute on function private.review_message_proposal(uuid,text,uuid,text,text,uuid),public.review_message_proposal(uuid,text,uuid,text,text,uuid) to authenticated;

create or replace function private.workspace_revision(p_patient uuid) returns text language plpgsql stable security definer set search_path='' as $$
declare role_name text:=private.patient_role(p_patient);value jsonb;begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 if role_name is null then
  if not exists(select 1 from private.memberships where patient_id=p_patient and user_id=auth.uid() and role='caregiver' and active) then raise exception 'Assigned access required' using errcode='42501';end if;
  return md5(coalesce((select jsonb_agg(jsonb_build_array(t.id,t.status))::text from public.support_tasks t where t.patient_id=p_patient and t.caregiver_id=auth.uid() and private.caregiver_allowed(p_patient,auth.uid())),'[]'));
 end if;
 select jsonb_build_array(
  (select jsonb_agg(jsonb_build_array(id,state,updated_at) order by id) from public.message_proposals where patient_id=p_patient),
  (select jsonb_agg(jsonb_build_array(id,state,next_owner,due_at,closed_at,review_note) order by id) from public.care_loops where patient_id=p_patient),
  (select jsonb_agg(jsonb_build_array(id,status,active) order by id) from public.care_plans where patient_id=p_patient),
  (select jsonb_agg(jsonb_build_array(id,state,updated_at) order by id) from public.intake_items where patient_id=p_patient),
  (select max(created_at) from public.intake_activity where patient_id=p_patient),
  (select max(created_at) from public.message_outbox where patient_id=p_patient),
  (select max(created_at) from public.evidence where patient_id=p_patient),
  (select max(occurred_at) from public.care_events where patient_id=p_patient),
  (select jsonb_build_array(count(*),max(observed_at)) from public.glucose_observations where patient_id=p_patient),
  (select max(created_at) from public.patient_context_entries where patient_id=p_patient),
  (select max(created_at) from public.activity_corrections where patient_id=p_patient),
  (select jsonb_agg(jsonb_build_array(caregiver_id,granted,updated_at)) from private.caregiver_consents where patient_id=p_patient),
  (select reminders_enabled from public.patients where id=p_patient)) into value;
 return md5(value::text);
end$$;
