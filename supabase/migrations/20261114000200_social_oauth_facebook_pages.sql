begin;

do $$
begin
  if to_regnamespace('cron') is null then
    raise exception 'pg_cron must be enabled before Facebook OAuth can be installed';
  end if;
end;
$$;

alter table public.social_oauth_transactions
  drop constraint if exists social_oauth_transactions_redirect_uri_check;
alter table public.social_oauth_transactions
  add constraint social_oauth_transactions_redirect_uri_check
  check (
    redirect_uri ~
      '^https://[^/?#]+/api/social-accounts/oauth/callback/(instagram|tiktok|youtube|linkedin|facebook)$'
  );

alter table public.social_accounts
  add column display_name text
    check (
      display_name is null or
      (length(display_name) between 1 and 200 and display_name !~ '[[:cntrl:]]')
    );
alter table public.social_accounts
  add constraint facebook_social_accounts_require_page_oauth
  check (
    platform <> 'facebook'
    or (
      connection_kind in ('oauth', 'expired')
      and handle ~ '^[0-9]{1,32}$'
      and display_name is not null
    )
  );
grant select (display_name) on public.social_accounts to authenticated;

create table public.social_facebook_page_selections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  session_id uuid not null,
  token_vault_id uuid not null,
  pages jsonb not null check (
    jsonb_typeof(pages) = 'array'
    and jsonb_array_length(pages) between 1 and 20
  ),
  expires_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp()
);
create unique index social_facebook_page_selections_owner_session_uidx
  on public.social_facebook_page_selections(user_id, session_id);
create index social_facebook_page_selections_expiry_idx
  on public.social_facebook_page_selections(expires_at);
alter table public.social_facebook_page_selections enable row level security;
revoke all on public.social_facebook_page_selections from public, anon, authenticated;
grant all on public.social_facebook_page_selections to service_role;

create function public.expire_facebook_page_selections()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_selection record;
  v_count integer := 0;
begin
  for v_selection in
    select id, token_vault_id
    from public.social_facebook_page_selections
    where expires_at <= clock_timestamp()
    order by expires_at
    for update skip locked
  loop
    delete from vault.secrets where id = v_selection.token_vault_id;
    delete from public.social_facebook_page_selections where id = v_selection.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.expire_facebook_page_selections()
  from public, anon, authenticated;
grant execute on function public.expire_facebook_page_selections()
  to service_role;

create function public.stage_facebook_page_selection(
  p_user uuid,
  p_session uuid,
  p_token_secret text,
  p_pages jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_secret uuid;
  v_secret uuid;
begin
  if p_user is null or p_session is null
    or p_token_secret is null or length(p_token_secret) not between 1 and 131072
    or p_pages is null
    or jsonb_typeof(p_pages) <> 'array'
    or jsonb_array_length(p_pages) not between 1 and 20
    or exists (
      select 1 from jsonb_array_elements(p_pages) as page
      where jsonb_typeof(page) <> 'object'
        or coalesce(page->>'id', '') !~ '^[0-9]{1,32}$'
        or length(coalesce(page->>'name', '')) not between 1 and 200
        or (page->>'name') ~ '[[:cntrl:]]'
    )
    or (select count(distinct page->>'id')
        from jsonb_array_elements(p_pages) as page) <> jsonb_array_length(p_pages) then
    raise exception 'Facebook Page selection invalid' using errcode = '22023';
  end if;

  perform 1 from public.users where id = p_user for update;
  if not found then
    raise exception 'OAuth owner unavailable' using errcode = '42501';
  end if;

  perform public.expire_facebook_page_selections();

  for v_old_secret in
    select token_vault_id from public.social_facebook_page_selections
    where user_id = p_user and (session_id = p_session or expires_at <= clock_timestamp())
    for update
  loop
    delete from vault.secrets where id = v_old_secret;
  end loop;
  delete from public.social_facebook_page_selections
  where user_id = p_user and (session_id = p_session or expires_at <= clock_timestamp());

  v_secret := vault.create_secret(
    p_token_secret,
    'social-facebook-pages-' || gen_random_uuid()::text,
    'Temporary server-only Facebook Page selection credentials'
  );
  insert into public.social_facebook_page_selections (
    user_id, session_id, token_vault_id, pages, expires_at
  )
  values (
    p_user, p_session, v_secret, p_pages, clock_timestamp() + interval '10 minutes'
  );
end;
$$;
revoke all on function public.stage_facebook_page_selection(uuid,uuid,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.stage_facebook_page_selection(uuid,uuid,text,jsonb)
  to service_role;

create function public.read_facebook_page_selection(p_user uuid, p_session uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_selection public.social_facebook_page_selections%rowtype;
  v_secret text;
begin
  select * into v_selection
  from public.social_facebook_page_selections
  where user_id = p_user and session_id = p_session
  for update;
  if not found then
    return null;
  end if;
  if v_selection.expires_at <= clock_timestamp() then
    delete from vault.secrets where id = v_selection.token_vault_id;
    delete from public.social_facebook_page_selections where id = v_selection.id;
    return null;
  end if;
  select decrypted_secret into v_secret
  from vault.decrypted_secrets where id = v_selection.token_vault_id;
  if v_secret is null then
    raise exception 'Facebook Page selection unavailable' using errcode = 'P0001';
  end if;
  return jsonb_build_object(
    'pages', v_selection.pages,
    'token_secret', v_secret,
    'expires_at', v_selection.expires_at
  );
end;
$$;
revoke all on function public.read_facebook_page_selection(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.read_facebook_page_selection(uuid,uuid)
  to service_role;

create function public.save_facebook_page_selection(
  p_user uuid,
  p_session uuid,
  p_page_ids text[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.account_plan;
  v_selection public.social_facebook_page_selections%rowtype;
  v_bundle jsonb;
  v_page jsonb;
  v_page_id text;
  v_page_name text;
  v_page_token text;
  v_user_token text;
  v_expires_at timestamptz;
  v_secret uuid;
  v_old_secret uuid;
  v_account_id uuid;
  v_kind text;
  v_new_count integer;
  v_count integer;
begin
  if p_user is null or p_session is null
    or p_page_ids is null or cardinality(p_page_ids) not between 1 and 20
    or exists (select 1 from unnest(p_page_ids) as id where id !~ '^[0-9]{1,32}$')
    or (select count(distinct id) from unnest(p_page_ids) as id) <> cardinality(p_page_ids) then
    raise exception 'Facebook Page selection invalid' using errcode = '22023';
  end if;

  select plan into v_plan from public.users where id = p_user for update;
  if not found then
    raise exception 'OAuth owner unavailable' using errcode = '42501';
  end if;
  select * into v_selection
  from public.social_facebook_page_selections
  where user_id = p_user and session_id = p_session
    and expires_at > clock_timestamp()
  for update;
  if not found then
    raise exception 'Facebook Page selection expired' using errcode = '42501';
  end if;

  select decrypted_secret::jsonb into v_bundle
  from vault.decrypted_secrets where id = v_selection.token_vault_id;
  if v_bundle is null or jsonb_typeof(v_bundle->'pages') <> 'array' then
    raise exception 'Facebook Page credentials unavailable' using errcode = 'P0001';
  end if;
  v_user_token := v_bundle->>'userAccessToken';
  v_expires_at := (v_bundle->>'expiresAt')::timestamptz;
  if v_user_token is null or length(v_user_token) not between 1 and 4096
    or v_expires_at <= clock_timestamp() then
    raise exception 'Facebook Page credentials unavailable' using errcode = 'P0001';
  end if;

  foreach v_page_id in array p_page_ids loop
    select item into v_page
    from jsonb_array_elements(v_selection.pages) as item
    where item->>'id' = v_page_id;
    if v_page is null then
      raise exception 'Facebook Page selection invalid' using errcode = '22023';
    end if;
    select item into v_page
    from jsonb_array_elements(v_bundle->'pages') as item
    where item->>'id' = v_page_id;
    if v_page is null
      or v_page->>'name' is distinct from (
        select item->>'name' from jsonb_array_elements(v_selection.pages) as item
        where item->>'id' = v_page_id
      ) then
      raise exception 'Facebook Page credentials unavailable' using errcode = 'P0001';
    end if;
  end loop;

  if exists (
    select 1 from unnest(p_page_ids) as selected(id)
    join public.social_accounts account
      on account.user_id = p_user
      and account.platform = 'facebook'
      and account.handle = selected.id
    where account.connection_kind not in ('oauth', 'expired')
  ) then
    raise exception 'Facebook Page already declared' using errcode = '23505';
  end if;

  select count(*) into v_new_count
  from unnest(p_page_ids) as selected(id)
  where not exists (
    select 1 from public.social_accounts account
    where account.user_id = p_user
      and account.platform = 'facebook'
      and account.handle = selected.id
  );
  if v_plan = 'solo'
    and (select count(*) from public.social_accounts where user_id = p_user) + v_new_count > 3 then
    raise exception 'Social account limit reached' using errcode = 'MC001';
  end if;

  foreach v_page_id in array p_page_ids loop
    select item into v_page
    from jsonb_array_elements(v_bundle->'pages') as item
    where item->>'id' = v_page_id;
    v_page_name := v_page->>'name';
    v_page_token := v_page->>'accessToken';
    if v_page_token is null or length(v_page_token) not between 1 and 4096
      or v_page_name is null or length(v_page_name) not between 1 and 200 then
      raise exception 'Facebook Page credentials unavailable' using errcode = 'P0001';
    end if;

    select id, connection_kind, access_token_vault_id
      into v_account_id, v_kind, v_old_secret
    from public.social_accounts
    where user_id = p_user and platform = 'facebook' and handle = v_page_id
    for update;
    v_secret := vault.create_secret(
      jsonb_build_object(
        'accessToken', v_page_token,
        'userAccessToken', v_user_token,
        'expiresAt', v_expires_at
      )::text,
      'social-oauth-facebook-' || gen_random_uuid()::text,
      'Server-only Facebook Page access token bundle'
    );
    if v_old_secret is not null then
      delete from vault.secrets where id = v_old_secret;
    end if;
    if v_account_id is null then
      insert into public.social_accounts (
        user_id, platform, handle, display_name, connection_kind,
        access_token_vault_id, access_token_expires_at
      )
      values (
        p_user, 'facebook', v_page_id, v_page_name, 'oauth', v_secret, v_expires_at
      );
    else
      update public.social_accounts
      set display_name = v_page_name,
          connection_kind = 'oauth',
          access_token_vault_id = v_secret,
          access_token_expires_at = v_expires_at,
          connected_at = clock_timestamp()
      where id = v_account_id and user_id = p_user;
    end if;
  end loop;

  delete from vault.secrets where id = v_selection.token_vault_id;
  delete from public.social_facebook_page_selections where id = v_selection.id;
  return cardinality(p_page_ids);
end;
$$;
revoke all on function public.save_facebook_page_selection(uuid,uuid,text[])
  from public, anon, authenticated;
grant execute on function public.save_facebook_page_selection(uuid,uuid,text[])
  to service_role;

create function public.read_facebook_oauth_credentials(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user is null then
    raise exception 'OAuth owner unavailable' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(credentials.token_secret order by credentials.created_at), '[]'::jsonb)
    from (
      select secret.decrypted_secret as token_secret, account.connected_at as created_at
      from public.social_accounts as account
      join vault.decrypted_secrets as secret
        on secret.id = account.access_token_vault_id
      where account.user_id = p_user
        and account.platform = 'facebook'
        and account.connection_kind = 'oauth'
      union all
      select secret.decrypted_secret as token_secret, selection.created_at
      from public.social_facebook_page_selections as selection
      join vault.decrypted_secrets as secret
        on secret.id = selection.token_vault_id
      where selection.user_id = p_user
        and selection.expires_at > clock_timestamp()
    ) as credentials
  );
end;
$$;
revoke all on function public.read_facebook_oauth_credentials(uuid)
  from public, anon, authenticated;
grant execute on function public.read_facebook_oauth_credentials(uuid)
  to service_role;

create function public.disconnect_facebook_oauth_accounts(p_user uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret uuid;
  v_count integer;
begin
  if p_user is null then
    raise exception 'OAuth owner unavailable' using errcode = '42501';
  end if;
  perform 1 from public.users where id = p_user for update;
  if not found then
    raise exception 'OAuth owner unavailable' using errcode = '42501';
  end if;
  for v_secret in
    select access_token_vault_id from public.social_accounts
    where user_id = p_user and platform = 'facebook'
      and connection_kind = 'oauth' and access_token_vault_id is not null
    for update
  loop
    delete from vault.secrets where id = v_secret;
  end loop;
  for v_secret in
    select token_vault_id from public.social_facebook_page_selections
    where user_id = p_user
    for update
  loop
    delete from vault.secrets where id = v_secret;
  end loop;
  delete from public.social_facebook_page_selections where user_id = p_user;
  update public.social_accounts
  set connection_kind = 'expired',
      access_token_vault_id = null,
      access_token_expires_at = null
  where user_id = p_user and platform = 'facebook' and connection_kind = 'oauth';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.disconnect_facebook_oauth_accounts(uuid)
  from public, anon, authenticated;
grant execute on function public.disconnect_facebook_oauth_accounts(uuid)
  to service_role;

select cron.schedule(
  'social-facebook-page-selection-cleanup',
  '*/5 * * * *',
  'select public.expire_facebook_page_selections();'
);

commit;
