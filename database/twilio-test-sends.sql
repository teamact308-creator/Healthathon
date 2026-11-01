create table public.twilio_test_sends (
 test_key text primary key check(test_key='whatsapp_trial_v1'),
 actor_id uuid not null references auth.users,
 state text not null check(state in ('reserved','submitted','rejected','unknown')),
 message_sid text, provider_status text, error_code integer,
 created_at timestamptz not null default now()
);
alter table public.twilio_test_sends enable row level security;
revoke all on public.twilio_test_sends from public,anon,authenticated;
grant select,insert,update on public.twilio_test_sends to service_role;
