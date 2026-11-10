-- Durable, single-use OAuth state. No provider token is stored in this table.
begin;

create table public.social_oauth_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  session_id uuid not null,
  provider public.social_platform not null,
  state_hash text not null unique check (state_hash ~ '^[0-9a-f]{64}$'),
  pkce_verifier text check (
    pkce_verifier is null or
    (length(pkce_verifier) between 43 and 128 and pkce_verifier ~ '^[A-Za-z0-9._~-]+$')
  ),
  redirect_uri text not null check (
    redirect_uri ~ '^https://[^/?#]+/api/social-accounts/oauth/callback/(instagram|tiktok|youtube|linkedin)$'
  ),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  constraint social_oauth_transaction_expiry check (
    expires_at > created_at and expires_at <= created_at + interval '10 minutes'
  ),
  constraint social_oauth_transaction_provider_callback check (
    right(redirect_uri, length(provider::text)) = provider::text
  ),
  constraint social_oauth_transaction_pkce_provider check (
    (provider = 'youtube' and pkce_verifier is not null)
    or (provider <> 'youtube' and pkce_verifier is null)
  )
);
create index social_oauth_transactions_expiry_idx
  on public.social_oauth_transactions(expires_at);

alter table public.social_oauth_transactions enable row level security;
revoke all on public.social_oauth_transactions from public, anon, authenticated;
grant all on public.social_oauth_transactions to service_role;

create function public.consume_social_oauth_transaction(
  p_user uuid,
  p_session uuid,
  p_provider public.social_platform,
  p_state_hash text
)
returns table (
  user_id uuid,
  session_id uuid,
  provider public.social_platform,
  state_hash text,
  pkce_verifier text,
  redirect_uri text,
  expires_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  update public.social_oauth_transactions as transaction
  set consumed_at = clock_timestamp()
  where transaction.user_id = p_user
    and transaction.session_id = p_session
    and transaction.provider = p_provider
    and transaction.state_hash = p_state_hash
    and transaction.consumed_at is null
    and transaction.expires_at > clock_timestamp()
  returning
    transaction.user_id,
    transaction.session_id,
    transaction.provider,
    transaction.state_hash,
    transaction.pkce_verifier,
    transaction.redirect_uri,
    transaction.expires_at
$$;
revoke all on function public.consume_social_oauth_transaction(uuid,uuid,public.social_platform,text)
  from public, anon, authenticated;
grant execute on function public.consume_social_oauth_transaction(uuid,uuid,public.social_platform,text)
  to service_role;

commit;
