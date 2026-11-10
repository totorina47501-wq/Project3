-- Base LOCALE jetable uniquement. Le harnais remplace Supabase Vault par un stub éphémère.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('20000000-0000-0000-0000-000000000001','oauth-account-a@example.test',now()),
 ('20000000-0000-0000-0000-000000000002','oauth-account-b@example.test',now());
insert into public.social_accounts(user_id,platform,handle,connection_kind) values
 ('20000000-0000-0000-0000-000000000001','instagram','quota-one','manual'),
 ('20000000-0000-0000-0000-000000000001','tiktok','quota-two','manual'),
 ('20000000-0000-0000-0000-000000000001','linkedin','quota-three','manual');

set local role service_role;
do $$ begin
  for attempt in 1..5 loop
    perform public.create_social_oauth_transaction(
      '20000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000001',
      'tiktok',repeat(attempt::text,64),null,
      'https://local.test/api/social-accounts/oauth/callback/tiktok',
      clock_timestamp()+interval '5 minutes');
  end loop;
  begin
    perform public.create_social_oauth_transaction(
      '20000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000001',
      'tiktok',repeat('6',64),null,
      'https://local.test/api/social-accounts/oauth/callback/tiktok',
      clock_timestamp()+interval '5 minutes');
    raise exception 'OAuth transaction limit exceeded' using errcode='XX000';
  exception when raise_exception then null; end;
  begin
    perform public.save_social_oauth_account(
      '20000000-0000-0000-0000-000000000001','youtube','quota-fourth',
      '{"accessToken":"offline-fixture-token"}',clock_timestamp()+interval '1 hour');
    raise exception 'OAuth account exceeded the Solo quota' using errcode='XX000';
  exception when raise_exception then null; end;
end $$;
reset role;
do $$ begin
  if (select count(*) from public.social_oauth_transactions
    where user_id='20000000-0000-0000-0000-000000000001')<>5 then
    raise exception 'Pending OAuth transaction limit was not enforced';
  end if;
end $$;
delete from public.social_accounts
where user_id='20000000-0000-0000-0000-000000000001' and handle='quota-three';
set local role service_role;
do $$ declare
  account_id uuid;
  credential jsonb;
begin
  account_id:=public.save_social_oauth_account(
    '20000000-0000-0000-0000-000000000001','youtube','UC_test_channel',
    '{"accessToken":"offline-fixture-token"}',clock_timestamp()+interval '1 hour');
  perform set_config('test.oauth_account_id',account_id::text,true);
  credential:=public.read_social_oauth_token(
    '20000000-0000-0000-0000-000000000001',account_id);
  if credential->>'token_secret'<>'{"accessToken":"offline-fixture-token"}'
    or credential->>'provider'<>'youtube' then
    raise exception 'Vault credential not available to the server store';
  end if;
  if public.read_social_oauth_token(
    '20000000-0000-0000-0000-000000000002',account_id) is not null then
    raise exception 'Credential disclosed to another owner';
  end if;
  begin
    perform public.disconnect_social_oauth_account(
      '20000000-0000-0000-0000-000000000002',account_id);
    raise exception 'Cross-owner disconnect accepted' using errcode='XX000';
  exception when no_data_found then null; end;
  perform public.disconnect_social_oauth_account(
    '20000000-0000-0000-0000-000000000001',account_id);
  if public.read_social_oauth_token(
    '20000000-0000-0000-0000-000000000001',account_id) is not null then
    raise exception 'Disconnected token remains readable';
  end if;
end $$;
reset role;

do $$ begin
  if (select connection_kind from public.social_accounts
      where id=current_setting('test.oauth_account_id')::uuid)<>'expired'
    or exists(select 1 from vault.secrets) then
    raise exception 'Disconnect did not remove the Vault secret and expire account';
  end if;
end $$;

do $$ begin
  if has_function_privilege('anon','public.save_social_oauth_account(uuid,public.social_platform,text,text,timestamptz)','EXECUTE')
    or has_function_privilege('authenticated','public.save_social_oauth_account(uuid,public.social_platform,text,text,timestamptz)','EXECUTE')
    or has_function_privilege('authenticated','public.create_social_oauth_transaction(uuid,uuid,public.social_platform,text,text,text,timestamptz)','EXECUTE')
    or has_function_privilege('authenticated','public.read_social_oauth_token(uuid,uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.disconnect_social_oauth_account(uuid,uuid)','EXECUTE')
    or has_column_privilege('authenticated','public.social_accounts','access_token_vault_id','SELECT')
    or has_column_privilege('authenticated','public.social_accounts','access_token_vault_id','UPDATE')
    or has_column_privilege('authenticated','public.social_accounts','access_token_expires_at','SELECT')
    or has_table_privilege('authenticated','vault.secrets','SELECT')
    or has_table_privilege('authenticated','vault.decrypted_secrets','SELECT') then
    raise exception 'OAuth token or privileged function is exposed';
  end if;
  if not has_function_privilege('authenticated','public.expire_social_oauth_accounts(uuid)','EXECUTE') then
    raise exception 'Owner expiry maintenance is unavailable';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
do $$ begin
  begin
    perform public.expire_social_oauth_accounts('20000000-0000-0000-0000-000000000002');
    raise exception 'Cross-owner expiration accepted' using errcode='XX000';
  exception when insufficient_privilege then null; end;
  perform public.remove_social_account(
    current_setting('test.oauth_account_id')::uuid);
  if exists(select 1 from public.social_accounts
    where id=current_setting('test.oauth_account_id')::uuid) then
    raise exception 'Owner could not remove an expired social account';
  end if;
end $$;

select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
do $$ begin
  begin
    perform public.remove_social_account(
      current_setting('test.oauth_account_id')::uuid);
    raise exception 'Cross-owner removal accepted' using errcode='XX000';
  exception when no_data_found then null; end;
end $$;
rollback;
