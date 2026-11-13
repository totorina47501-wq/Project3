-- Base LOCALE jetable uniquement. Le harnais remplace Supabase Vault par un stub éphémère.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('20000000-0000-0000-0000-000000000001','oauth-account-a@example.test',now()),
 ('20000000-0000-0000-0000-000000000002','oauth-account-b@example.test',now()),
 ('20000000-0000-0000-0000-000000000003','oauth-account-c@example.test',now());
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
  begin
    perform public.save_social_oauth_account(
      '20000000-0000-0000-0000-000000000001','facebook','personal-profile',
      '{"accessToken":"offline-fixture-token"}',clock_timestamp()+interval '1 hour');
    raise exception 'Generic Facebook OAuth account creation accepted' using errcode='XX000';
  exception when check_violation then null; end;
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

set local role service_role;
do $$ declare owner_account uuid; server_account uuid;
begin
  owner_account:=public.save_social_oauth_account(
    '20000000-0000-0000-0000-000000000001','youtube','UC_test_channel',
    '{"accessToken":"owner-expiry-fixture"}',clock_timestamp()+interval '1 hour');
  server_account:=public.save_social_oauth_account(
    '20000000-0000-0000-0000-000000000002','youtube','UC_server_expiry',
    '{"accessToken":"server-expiry-fixture"}',clock_timestamp()+interval '1 hour');
  perform set_config('test.oauth_expiry_owner_account',owner_account::text,true);
  perform set_config('test.oauth_expiry_server_account',server_account::text,true);
end $$;
reset role;
update public.social_accounts
set access_token_expires_at=clock_timestamp()-interval '1 second'
where id in (
  current_setting('test.oauth_expiry_owner_account')::uuid,
  current_setting('test.oauth_expiry_server_account')::uuid
);

do $$ begin
  if has_function_privilege('anon','public.save_social_oauth_account(uuid,public.social_platform,text,text,timestamptz)','EXECUTE')
    or has_function_privilege('authenticated','public.save_social_oauth_account(uuid,public.social_platform,text,text,timestamptz)','EXECUTE')
    or has_function_privilege('authenticated','public.create_social_oauth_transaction(uuid,uuid,public.social_platform,text,text,text,timestamptz)','EXECUTE')
    or has_function_privilege('authenticated','public.read_social_oauth_token(uuid,uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.disconnect_social_oauth_account(uuid,uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.stage_facebook_page_selection(uuid,uuid,text,jsonb)','EXECUTE')
    or has_function_privilege('authenticated','public.read_facebook_page_selection(uuid,uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.save_facebook_page_selection(uuid,uuid,text[])','EXECUTE')
    or has_function_privilege('authenticated','public.disconnect_facebook_oauth_accounts(uuid)','EXECUTE')
    or has_table_privilege('authenticated','public.social_facebook_page_selections','SELECT')
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
  if has_function_privilege('anon','public.expire_social_oauth_accounts(uuid)','EXECUTE')
    or not has_function_privilege('service_role','public.expire_social_oauth_accounts(uuid)','EXECUTE') then
    raise exception 'Expiry maintenance is exposed or unavailable to the server role';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
do $$ begin
  begin
    perform set_config('request.jwt.claim.sub','',true);
    perform public.expire_social_oauth_accounts('20000000-0000-0000-0000-000000000001');
    raise exception 'NULL-actor expiration accepted' using errcode='XX000';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
  begin
    perform public.expire_social_oauth_accounts('20000000-0000-0000-0000-000000000001');
    raise exception 'Cross-owner expiration accepted' using errcode='XX000';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
  perform public.expire_social_oauth_accounts('20000000-0000-0000-0000-000000000001');
end $$;
reset role;

do $$ begin
  if (select connection_kind from public.social_accounts
      where id=current_setting('test.oauth_expiry_owner_account')::uuid)<>'expired'
    or exists(select 1 from vault.secrets
      where secret='{"accessToken":"owner-expiry-fixture"}')
    or (select connection_kind from public.social_accounts
      where id=current_setting('test.oauth_expiry_server_account')::uuid)<>'oauth' then
    raise exception 'Owner expiration failed or crossed the tenant boundary';
  end if;
end $$;

set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.jwt.claim.sub','',true);
select public.expire_social_oauth_accounts(
  '20000000-0000-0000-0000-000000000002');
reset role;

set local role service_role;
select public.create_social_oauth_transaction(
  '20000000-0000-0000-0000-000000000003',
  '30000000-0000-0000-0000-000000000003',
  'facebook',repeat('f',64),null,
  'https://mentioncheck-staging.toto-rina47501.workers.dev/api/social-accounts/oauth/callback/facebook',
  clock_timestamp()+interval '5 minutes');
do $$ declare selection jsonb; selected_count integer; begin
  perform public.stage_facebook_page_selection(
    '20000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000003',
    jsonb_build_object(
      'accessToken','offline-facebook-user',
      'userAccessToken','offline-facebook-user',
      'expiresAt',(clock_timestamp()+interval '1 hour')::text,
      'pages',jsonb_build_array(
        jsonb_build_object('id','9001','name','Page A','accessToken','offline-page-9001'),
        jsonb_build_object('id','9002','name','Page B','accessToken','offline-page-9002')
      )
    )::text,
    '[{"id":"9001","name":"Page A"},{"id":"9002","name":"Page B"}]'::jsonb
  );
  selection:=public.read_facebook_page_selection(
    '20000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000003');
  if selection->'pages' <> '[{"id":"9001","name":"Page A"},{"id":"9002","name":"Page B"}]'::jsonb
    or selection->>'token_secret' not like '%offline-facebook-user%' then
    raise exception 'Owner could not read staged Facebook selection';
  end if;
  if public.read_facebook_page_selection(
    '20000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000003') is not null then
    raise exception 'Facebook selection disclosed across tenants';
  end if;
  if public.read_facebook_page_selection(
    '20000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000002') is not null then
    raise exception 'Facebook selection disclosed across sessions';
  end if;
  begin
    perform public.save_facebook_page_selection(
      '20000000-0000-0000-0000-000000000002',
      '30000000-0000-0000-0000-000000000003',array['9001']::text[]);
    raise exception 'Cross-tenant Facebook selection accepted' using errcode='XX000';
  exception when insufficient_privilege then null; end;
  begin
    perform public.save_facebook_page_selection(
      '20000000-0000-0000-0000-000000000003',
      '30000000-0000-0000-0000-000000000003',array['9999']::text[]);
    raise exception 'Unlisted Facebook Page selected' using errcode='XX000';
  exception when invalid_parameter_value then null; end;

  selected_count:=public.save_facebook_page_selection(
    '20000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000003',array['9001','9002']::text[]);
  if selected_count<>2 then
    raise exception 'Facebook Page RPC returned the wrong selected count';
  end if;
end $$;
reset role;
do $$ begin
  if (select count(*) from public.social_accounts
      where user_id='20000000-0000-0000-0000-000000000003'
        and platform='facebook' and connection_kind='oauth')<>2
    or (select display_name from public.social_accounts
        where user_id='20000000-0000-0000-0000-000000000003'
          and platform='facebook' and handle='9001')<>'Page A' then
    raise exception 'Explicit Facebook Page selection was not persisted';
  end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
do $$ begin
  if (select count(*) from public.social_accounts
      where user_id='20000000-0000-0000-0000-000000000003'
        and platform='facebook')<>0 then
    raise exception 'Facebook Page metadata disclosed across tenants';
  end if;
end $$;
reset role;

set local role service_role;
do $$ declare selected_count integer; begin
  perform public.stage_facebook_page_selection(
    '20000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000003',
    jsonb_build_object(
      'accessToken','offline-facebook-user',
      'userAccessToken','offline-facebook-user',
      'expiresAt',(clock_timestamp()+interval '1 hour')::text,
      'pages',jsonb_build_array(
        jsonb_build_object('id','9001','name','Page A actualisée','accessToken','offline-page-9001-new')
      )
    )::text,
    '[{"id":"9001","name":"Page A actualisée"}]'::jsonb
  );
  selected_count:=public.save_facebook_page_selection(
    '20000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000003',array['9001']::text[]);
  if selected_count<>1 then
    raise exception 'Facebook reconnect returned the wrong Page count';
  end if;
end $$;
reset role;
do $$ begin
  if (select count(*) from public.social_accounts
      where user_id='20000000-0000-0000-0000-000000000003'
        and platform='facebook')<>2
    or (select display_name from public.social_accounts
        where user_id='20000000-0000-0000-0000-000000000003'
          and platform='facebook' and handle='9001')<>'Page A actualisée' then
    raise exception 'Facebook refresh duplicated a selected Page';
  end if;
end $$;

set local role service_role;
do $$ declare selected_count integer; begin
  perform public.stage_facebook_page_selection(
    '20000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000003',
    jsonb_build_object(
      'accessToken','offline-facebook-user',
      'userAccessToken','offline-facebook-user',
      'expiresAt',(clock_timestamp()+interval '1 hour')::text,
      'pages',jsonb_build_array(
        jsonb_build_object('id','9002','name','Page B refreshed','accessToken','offline-page-9002-new'),
        jsonb_build_object('id','9003','name','Page C','accessToken','offline-page-9003'),
        jsonb_build_object('id','9004','name','Page D','accessToken','offline-page-9004')
      )
    )::text,
    '[{"id":"9002","name":"Page B refreshed"},{"id":"9003","name":"Page C"},{"id":"9004","name":"Page D"}]'::jsonb
  );
  begin
    perform public.save_facebook_page_selection(
      '20000000-0000-0000-0000-000000000003',
      '30000000-0000-0000-0000-000000000003',array['9002','9003','9004']::text[]);
    raise exception 'Multi-Page selection bypassed Solo quota' using errcode='XX000';
  exception when raise_exception then null; end;
end $$;
reset role;
do $$ begin
  if (select count(*) from public.social_accounts
      where user_id='20000000-0000-0000-0000-000000000003'
        and platform='facebook')<>2
    or exists(select 1 from public.social_accounts
      where user_id='20000000-0000-0000-0000-000000000003'
        and platform='facebook' and handle in ('9003','9004')) then
    raise exception 'Quota failure partially persisted selected Pages';
  end if;
end $$;

set local role service_role;
do $$ declare selected_count integer; begin
  selected_count:=public.disconnect_facebook_oauth_accounts(
    '20000000-0000-0000-0000-000000000003');
  if selected_count<>2 then
    raise exception 'Facebook disconnect returned the wrong Page count';
  end if;
end $$;
reset role;
do $$ begin
  if exists(select 1 from public.social_accounts
      where user_id='20000000-0000-0000-0000-000000000003'
        and platform='facebook' and connection_kind='oauth')
    or exists(select 1 from vault.secrets where secret like '%offline-facebook-%') then
    raise exception 'Global Facebook revocation did not expire and clear all local Page tokens';
  end if;
end $$;

set local role service_role;
do $$ declare selection jsonb; begin
  perform public.stage_facebook_page_selection(
    '20000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000002',
    jsonb_build_object(
      'accessToken','offline-facebook-expiring-user',
      'userAccessToken','offline-facebook-expiring-user',
      'expiresAt',(clock_timestamp()+interval '1 hour')::text,
      'pages',jsonb_build_array(
        jsonb_build_object('id','9101','name','Temporary Page','accessToken','offline-page-expiring')
      )
    )::text,
    '[{"id":"9101","name":"Temporary Page"}]'::jsonb
  );
  update public.social_facebook_page_selections
  set expires_at=clock_timestamp()-interval '1 second'
  where user_id='20000000-0000-0000-0000-000000000002'
    and session_id='30000000-0000-0000-0000-000000000002';
  selection:=public.read_facebook_page_selection(
    '20000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000002');
  if selection is not null then raise exception 'Expired Facebook selection was returned'; end if;
end $$;
reset role;
do $$ begin
  if exists(select 1 from public.social_facebook_page_selections
      where user_id='20000000-0000-0000-0000-000000000002')
    or exists(select 1 from vault.secrets where secret like '%offline-facebook-expiring-user%') then
    raise exception 'Expired Facebook selection or Vault secret was retained';
  end if;
end $$;

do $$ begin
  if (select count(*) from public.social_accounts
      where user_id='20000000-0000-0000-0000-000000000003'
        and platform='facebook' and connection_kind='expired')<>2 then
    raise exception 'Disconnected Facebook Pages were not retained as expired rows';
  end if;
end $$;

/*
  This subtransaction has already verified that quota denial left both the
  existing Page rows and their Vault secrets unchanged.
*/
do $$ begin
  if has_function_privilege('authenticated','public.disconnect_facebook_oauth_accounts(uuid)','EXECUTE') then
    raise exception 'Facebook global revoke RPC exposed to authenticated';
  end if;
end $$;
do $$ begin
  if (select connection_kind from public.social_accounts
      where id=current_setting('test.oauth_expiry_server_account')::uuid)<>'expired'
    or exists(select 1 from vault.secrets
      where secret='{"accessToken":"server-expiry-fixture"}') then
    raise exception 'Service-role expiry failed to remove its Vault secret';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
do $$ begin
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
