begin;

create or replace function public.expire_social_oauth_accounts(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  expired_account record;
begin
  if p_user is null then
    raise exception 'OAuth owner unavailable' using errcode = '42501';
  end if;
  if v_actor is null then
    if auth.role() is distinct from 'service_role' then
      raise exception 'OAuth session required' using errcode = '42501';
    end if;
  elsif v_actor <> p_user then
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

commit;
