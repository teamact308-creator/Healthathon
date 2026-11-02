create index patients_clinic_idx on public.patients(clinic_id);
create index plans_patient_idx on public.care_plans(patient_id);
create index plans_confirmer_idx on public.care_plans(confirmed_by);
create index items_plan_patient_idx on public.care_plan_items(plan_id,patient_id);
create index loops_item_patient_idx on public.care_loops(item_id,patient_id);
create index events_loop_patient_idx on public.care_events(loop_id,patient_id);
create index events_actor_idx on public.care_events(actor_id);
create index events_patient_idx on public.care_events(patient_id);
create index evidence_loop_patient_idx on public.evidence(loop_id,patient_id);
create index evidence_submitter_idx on public.evidence(submitted_by);
create index evidence_patient_idx on public.evidence(patient_id);
create index observations_patient_time_idx on public.glucose_observations(patient_id,observed_at);
create index outbox_loop_patient_idx on public.message_outbox(loop_id,patient_id);
create index outbox_patient_idx on public.message_outbox(patient_id);
create index support_loop_patient_idx on public.support_tasks(loop_id,patient_id);
create index support_caregiver_idx on public.support_tasks(caregiver_id);
create index support_patient_idx on public.support_tasks(patient_id);
create index audit_loop_idx on public.audit_events(loop_id);
create index audit_patient_time_idx on public.audit_events(patient_id,created_at desc);
create index request_loop_idx on private.request_keys(loop_id);
-- Explicit default-deny documents the intended private-table boundary.
create policy internal_only on private.memberships for all to authenticated using(false) with check(false);
create policy internal_only on private.caregiver_consents for all to authenticated using(false) with check(false);
create policy internal_only on private.request_keys for all to authenticated using(false) with check(false);

