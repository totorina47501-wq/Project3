-- Inbox Stripe pour déduplication, strictement serveur; aucune facturation activée.
begin;
create table if not exists public.stripe_webhook_events (
  event_id text primary key check (event_id ~ '^evt_[A-Za-z0-9]+$'),
  event_type text not null,
  status text not null default 'processing' check (status in ('processing','processed','failed')),
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists stripe_events_received_at_idx on public.stripe_webhook_events(received_at desc);
alter table public.stripe_webhook_events enable row level security;
revoke all on public.stripe_webhook_events from public,anon,authenticated;
comment on table public.stripe_webhook_events is
 'Deduplication Stripe : identifiants evenements uniquement, pas de payload de paiement.';
commit;
