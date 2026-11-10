begin;

create extension if not exists supabase_vault with schema vault;

create function public.create_social_oauth_transaction(
  p_user uuid,
  p_session uuid,
  p_provider public.social_platform,
  p_state_hash text,
  p_pkce_verifier text,
  p_redirect_uri text,
  p_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user is null or p_session is null then
    raise exception 'OAuth session unavailable' using errcode = '42501';
  end if;
  perform 1 from public.users where id = p_user for update;
  if not found then
    raise exception 'OAuth owner unavailable' using errcode = '42501';
  end if;
  delete from public.social_oauth_transactions
  where user_id = p_user and expires_at <= clock_timestamp();
  if (
    select count(*)
    from public.social_oauth_transactions
    where user_id = p_user
      and session_id = p_session
      and provider = p_provider
      and consumed_at is null
      and expires_at > clock_timestamp()
  ) >= 5 then
    raise exception 'Too many pending OAuth transactions' using errcode = 'P0001';
  end if;
  insert into public.social_oauth_transactions (
    user_id, session_id, provider, state_hash, pkce_verifier, redirect_uri, expires_at
  )
  values (
    p_user, p_session, p_provider, p_state_hash, p_pkce_verifier, p_redirect_uri, p_expires_at
  );
end;
$$;
revoke all on function public.create_social_oauth_transaction(
  uuid, uuid, public.social_platform, text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.create_social_oauth_transaction(
  uuid, uuid, public.social_platform, text, text, text, timestamptz
) to service_role;

alter table public.social_accounts
  drop constraint if exists social_accounts_connection_kind_check;
alter table public.social_accounts
  add constraint social_accounts_connection_kind_check
  check (connection_kind in ('manual', 'oauth', 'expired', 'unknown'));
alter table public.social_accounts
  add column access_token_expires_at timestamptz;

update public.social_accounts
set connection_kind = 'expired',
    access_token_vault_id = null
where connection_kind = 'oauth';

alter table public.social_accounts
  add constraint social_oauth_credential_state_check
  check (
    (connection_kind = 'oauth'
      and access_token_vault_id is not null
      and access_token_expires_at is not null)
    or (connection_kind <> 'oauth'
      and access_token_vault_id is null
      and access_token_expires_at is null)
  );

create function public.save_social_oauth_account(
  p_user uuid,
  p_platform public.social_platform,
  p_handle text,
  p_token_secret text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.account_plan;
  v_id uuid;
  v_kind text;
  v_old_secret uuid;
  v_secret uuid;
  v_handle text;
begin
  if p_user is null or p_platform is null
    or p_token_secret is null or length(p_token_secret) not between 1 and 16384
    or p_expires_at is null or p_expires_at <= clock_timestamp()
    or p_expires_at > clock_timestamp() + interval '366 days' then
    raise exception 'OAuth account invalid' using errcode = '22023';
  end if;

  v_handle := regexp_replace(btrim(p_handle), '^@', '');
  if v_handle is null or length(v_handle) not between 1 and 200
    or v_handle !~ '^[[:alnum:]][[:alnum:]._-]*$' then
    raise exception 'OAuth account invalid' using errcode = '22023';
  end if;

  select plan into v_plan
  from public.users
  where id = p_user
  for update;
  if not found then
    raise exception 'OAuth owner unavailable' using errcode = '42501';
  end if;

  select id, connection_kind, access_token_vault_id
  into v_id, v_kind, v_old_secret
  from public.social_accounts
  where user_id = p_user and platform = p_platform and handle = v_handle
  for update;

  if found and v_kind not in ('oauth', 'expired') then
    raise exception 'Account already exists' using errcode = '23505';
  end if;
  if not found and v_plan = 'solo'
    and (select count(*) from public.social_accounts where user_id = p_user) >= 3 then
    raise exception 'Social account limit reached' using errcode = 'P0001';
  end if;

  v_secret := vault.create_secret(
    p_token_secret,
    'social-oauth-' || p_platform::text,
    'Server-only OAuth access token bundle'
  );
  if v_old_secret is not null then
    delete from vault.secrets where id = v_old_secret;
  end if;

  if v_id is null then
    insert into public.social_accounts (
      user_id, platform, handle, connection_kind,
      access_token_vault_id, access_token_expires_at
    )
    values (p_user, p_platform, v_handle, 'oauth', v_secret, p_expires_at)
    returning id into v_id;
  else
    update public.social_accounts
    set connection_kind = 'oauth',
        access_token_vault_id = v_secret,
        access_token_expires_at = p_expires_at,
        connected_at = clock_timestamp()
    where id = v_id and user_id = p_user;
  end if;
  return v_id;
end;
$$;
revoke all on function public.save_social_oauth_account(
  uuid, public.social_platform, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.save_social_oauth_account(
  uuid, public.social_platform, text, text, timestamptz
) to service_role;

create function public.read_social_oauth_token(p_user uuid, p_account uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'provider', account.platform,
    'token_secret', secret.decrypted_secret
  )
  from public.social_accounts as account
  join vault.decrypted_secrets as secret
    on secret.id = account.access_token_vault_id
  where account.id = p_account
    and account.user_id = p_user
    and account.connection_kind = 'oauth'
    and account.access_token_expires_at > clock_timestamp()
$$;
revoke all on function public.read_social_oauth_token(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.read_social_oauth_token(uuid, uuid)
  to service_role;

create function public.disconnect_social_oauth_account(p_user uuid, p_account uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret uuid;
begin
  select access_token_vault_id into v_secret
  from public.social_accounts
  where id = p_account
    and user_id = p_user
    and connection_kind in ('oauth', 'expired')
  for update;
  if not found then
    raise exception 'OAuth account unavailable' using errcode = 'P0002';
  end if;
  if v_secret is not null then
    delete from vault.secrets where id = v_secret;
  end if;
  update public.social_accounts
  set connection_kind = 'expired',
      access_token_vault_id = null,
      access_token_expires_at = null
  where id = p_account and user_id = p_user;
end;
$$;
revoke all on function public.disconnect_social_oauth_account(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.disconnect_social_oauth_account(uuid, uuid)
  to service_role;

create function public.expire_social_oauth_accounts(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired_account record;
begin
  if auth.uid() is not null and auth.uid() <> p_user then
    raise exception 'OAuth owner mismatch' using errcode = '42501';
  end if;
  for expired_account in
    select id, access_token_vault_id
    from public.social_accounts
    where user_id = p_user
      and connection_kind = 'oauth'
      and access_token_expires_at <= clock_timestamp()
    for update
  loop
    if expired_account.access_token_vault_id is not null then
      delete from vault.secrets where id = expired_account.access_token_vault_id;
    end if;
    update public.social_accounts
    set connection_kind = 'expired',
        access_token_vault_id = null,
        access_token_expires_at = null
    where id = expired_account.id and user_id = p_user;
  end loop;
end;
$$;
revoke all on function public.expire_social_oauth_accounts(uuid)
  from public, anon, authenticated;
grant execute on function public.expire_social_oauth_accounts(uuid)
  to service_role, authenticated;

create or replace function public.remove_social_account(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_kind text;
begin
  if v_user is null then
    raise exception 'Session required' using errcode = '42501';
  end if;
  perform 1 from public.users where id = v_user for update;
  if not found then
    raise exception 'Profile unavailable' using errcode = '42501';
  end if;
  select connection_kind into v_kind
  from public.social_accounts
  where id = p_id and user_id = v_user
  for update;
  if not found then
    raise exception 'Account unavailable' using errcode = 'P0002';
  end if;
  if v_kind not in ('manual', 'expired') then
    raise exception 'Disconnected or manual account required' using errcode = '42501';
  end if;
  delete from public.social_accounts where id = p_id and user_id = v_user;
end;
$$;
revoke all on function public.remove_social_account(uuid) from public, anon, authenticated;
grant execute on function public.remove_social_account(uuid) to authenticated;

commit;
