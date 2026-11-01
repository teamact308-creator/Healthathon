-- Technical handshake receipts only: no phone numbers, message bodies or patient linkage.
create table public.whatsapp_webhook_receipts (
 message_sid text primary key check(message_sid ~ '^SM[0-9a-fA-F]{32}$'),
 received_at timestamptz not null default now(),
 kind text not null check(kind in ('hello','other'))
);
alter table public.whatsapp_webhook_receipts enable row level security;
revoke all on public.whatsapp_webhook_receipts from public, anon, authenticated;
grant select, insert on public.whatsapp_webhook_receipts to service_role;
