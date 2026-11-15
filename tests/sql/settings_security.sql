-- Base LOCALE jetable uniquement, après les migrations. Toutes les fixtures sont annulées.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('20000000-0000-0000-0000-000000000001','settings-a@example.test',now()),
 ('20000000-0000-0000-0000-000000000002','settings-b@example.test',now());
insert into public.social_accounts(user_id,platform,handle) values
 ('20000000-0000-0000-0000-000000000002','youtube','history');
do $$ begin
 if has_function_privilege('anon','public.save_social_account(uuid,public.social_platform,text)','EXECUTE')
 or has_function_privilege('anon','public.remove_social_account(uuid)','EXECUTE')
 or has_column_privilege('authenticated','public.social_accounts','access_token_vault_id','SELECT')
 or has_column_privilege('authenticated','public.social_accounts','access_token_vault_id','UPDATE')
 or has_table_privilege('authenticated','public.social_accounts','INSERT')
 or has_column_privilege('authenticated','public.users','plan','UPDATE') then
   raise exception 'Droits paramètres trop larges';
 end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
do $$ declare first_id uuid; last_id uuid; begin
 first_id:=public.save_social_account(null,'instagram',' @Camille ');
 perform set_config('test.settings_account_id',first_id::text,true);
 if (select handle from public.social_accounts where id=first_id)<>'camille'
 or (select connection_kind from public.social_accounts where id=first_id)<>'manual' then
   raise exception 'Métadonnées non normalisées';
 end if;
 begin
   perform public.save_social_account(null,'instagram','camille');
   raise exception 'Doublon accepté' using errcode='XX000';
 exception when unique_violation then null; end;
 perform public.save_social_account(null,'tiktok','second');
 last_id:=public.save_social_account(null,'linkedin','third');
 begin
   perform public.save_social_account(null,'youtube','fourth');
   raise exception 'Quota Solo ignoré' using errcode='XX000';
 exception when raise_exception then null; end;
 perform public.save_social_account(first_id,'instagram','renamed');
 perform public.remove_social_account(last_id);
 perform public.save_social_account(null,'youtube','replacement');
 if (select count(*) from public.social_accounts)<>3 then raise exception 'Quota/libération incorrects'; end if;
 insert into public.user_preferences(user_id,rewrite_tone) values(auth.uid(),'créatif');
 update public.user_preferences set rewrite_tone='institutionnel' where user_id=auth.uid();
 begin
   insert into public.user_preferences(user_id,rewrite_tone) values('20000000-0000-0000-0000-000000000002','naturel');
   raise exception 'Préférence tierce acceptée' using errcode='XX000';
 exception when insufficient_privilege then null; end;
 begin
   perform public.save_social_account(first_id,'instagram','https://evil.test/a');
   raise exception 'Lien accepté comme handle' using errcode='XX000';
 exception when invalid_parameter_value then null; end;
 begin
   perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
   perform public.save_social_account(null,'facebook','personal-profile');
   raise exception 'Facebook profile accepted as a manual social account' using errcode='XX000';
 exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
do $$ declare legacy uuid; other_id uuid:=current_setting('test.settings_account_id')::uuid; begin
 if exists(select 1 from public.user_preferences)
 or (select count(*) from public.social_accounts)<>1 then raise exception 'Fuite RLS'; end if;
 begin
   perform public.save_social_account(other_id,'instagram','stolen');
   raise exception 'Édition tierce acceptée' using errcode='XX000';
 exception when no_data_found then null; end;
 begin
   perform public.remove_social_account(other_id);
   raise exception 'Suppression tierce acceptée' using errcode='XX000';
 exception when no_data_found then null; end;
 select id into legacy from public.social_accounts where handle='history';
 begin
   perform public.save_social_account(legacy,'youtube','claim-oauth');
   raise exception 'Édition compte historique acceptée' using errcode='XX000';
 exception when insufficient_privilege then null; end;
 begin
   perform public.remove_social_account(legacy);
   raise exception 'Suppression compte historique acceptée' using errcode='XX000';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
