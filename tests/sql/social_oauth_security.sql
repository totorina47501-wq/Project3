-- Base LOCALE jetable uniquement, après les migrations. Toutes les fixtures sont annulées.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('20000000-0000-0000-0000-000000000001','oauth-a@example.test',now()),
 ('20000000-0000-0000-0000-000000000002','oauth-b@example.test',now());

set local role service_role;
insert into public.social_oauth_transactions
 (user_id,session_id,provider,state_hash,pkce_verifier,redirect_uri,expires_at,created_at)
values
 ('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',
  'youtube',repeat('1',64),repeat('a',43),
  'https://local.test/api/social-accounts/oauth/callback/youtube',clock_timestamp()+interval '5 minutes',clock_timestamp()),
 ('20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002',
  'tiktok',repeat('2',64),null,
  'https://local.test/api/social-accounts/oauth/callback/tiktok',clock_timestamp()+interval '5 minutes',clock_timestamp()),
 ('20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002',
  'instagram',repeat('3',64),null,
  'https://local.test/api/social-accounts/oauth/callback/instagram',
  clock_timestamp()-interval '1 minute',clock_timestamp()-interval '2 minutes');

do $$ declare attempt record; begin
  select * into attempt from public.consume_social_oauth_transaction(
   '20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','youtube',repeat('1',64));
  if not found or attempt.pkce_verifier<>repeat('a',43) then raise exception 'État valide non consommé'; end if;

  select * into attempt from public.consume_social_oauth_transaction(
   '20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','youtube',repeat('1',64));
  if found then raise exception 'Rejeu OAuth accepté'; end if;

  select * into attempt from public.consume_social_oauth_transaction(
   '20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','tiktok',repeat('2',64));
  if found then raise exception 'État d’un autre propriétaire accepté'; end if;

  select * into attempt from public.consume_social_oauth_transaction(
   '20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001','tiktok',repeat('2',64));
  if found then raise exception 'Session différente acceptée'; end if;

  select * into attempt from public.consume_social_oauth_transaction(
   '20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002','instagram',repeat('3',64));
  if found then raise exception 'État expiré accepté'; end if;

  select * into attempt from public.consume_social_oauth_transaction(
   '20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002','tiktok',repeat('2',64));
  if not found then raise exception 'État du propriétaire non consommé'; end if;
end $$;

reset role;
do $$ begin
  if has_table_privilege('anon','public.social_oauth_transactions','SELECT')
   or has_table_privilege('authenticated','public.social_oauth_transactions','SELECT')
   or has_table_privilege('authenticated','public.social_oauth_transactions','INSERT')
   or has_function_privilege('anon','public.consume_social_oauth_transaction(uuid,uuid,public.social_platform,text)','EXECUTE')
   or has_function_privilege('authenticated','public.consume_social_oauth_transaction(uuid,uuid,public.social_platform,text)','EXECUTE') then
    raise exception 'Accès direct aux états OAuth autorisé';
  end if;
end $$;
rollback;
