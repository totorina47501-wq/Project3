-- Hors ligne uniquement, après les migrations. Transaction annulée en fin de fichier.
-- Exécuter avec ON_ERROR_STOP=1 sur une base LOCALE jetable, jamais la production.
begin;
insert into auth.users (id,email,email_confirmed_at) values
 ('10000000-0000-0000-0000-000000000001','studio-owner@example.test',now()),
 ('10000000-0000-0000-0000-000000000002','studio-other@example.test',now()),
 ('10000000-0000-0000-0000-000000000003','studio-admin@example.test',now()),
 ('10000000-0000-0000-0000-000000000004','studio-member@example.test',now()),
 ('10000000-0000-0000-0000-000000000005','studio-five@example.test',now()),
 ('10000000-0000-0000-0000-000000000006','studio-six@example.test',null);
update public.users set plan='studio' where id in
 ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002');
-- Refuser un profil Studio historique sans abonnement valable.
do $legacy_gate$
begin
 if not exists(select 1 from public.users where id='10000000-0000-0000-0000-000000000001' and plan='studio')
 then raise exception 'Fixture Studio absente'; end if;
 if studio_private.has_active_studio_subscription('10000000-0000-0000-0000-000000000001'::uuid)
 then raise exception 'Un profil historique ne vaut pas un abonnement'; end if;
end $legacy_gate$;
-- Souscriptions de test strictement dans la transaction PGlite à rollback.
insert into public.subscriptions(user_id,stripe_subscription_id,plan,status,current_period_end) values
 ('10000000-0000-0000-0000-000000000001','sub_studio_fixture_a','studio','active',now()+interval '30 days'),
 ('10000000-0000-0000-0000-000000000002','sub_studio_fixture_b','studio','active',now()+interval '30 days');
insert into public.verifications(user_id,platform,content_text) values
 ('10000000-0000-0000-0000-000000000001','instagram','Historique personnel du propriétaire, jamais partagé'),
 ('10000000-0000-0000-0000-000000000004','youtube','Historique personnel du membre, jamais partagé');
create function pg_temp.expect_denied(actor uuid, workspace uuid, action text, payload jsonb default '{}')
returns void language plpgsql as $$
begin
  perform public.studio_execute(actor,workspace,action,payload);
  raise exception 'Studio attendu refusé: %',action using errcode='XX000';
exception when insufficient_privilege or invalid_parameter_value or unique_violation or check_violation then null;
end $$;
do $$
declare
 owner_id uuid := '10000000-0000-0000-0000-000000000001';
 other_id uuid := '10000000-0000-0000-0000-000000000002';
 admin_id uuid := '10000000-0000-0000-0000-000000000003';
 member_id uuid := '10000000-0000-0000-0000-000000000004';
 ws uuid; other_ws uuid; inv uuid; key_id uuid; got jsonb;
begin
 if has_function_privilege('anon','public.studio_execute(uuid,uuid,text,jsonb)','EXECUTE')
 or has_function_privilege('authenticated','public.studio_execute(uuid,uuid,text,jsonb)','EXECUTE')
 or has_function_privilege('authenticated','public.studio_execute_api(text,text,jsonb)','EXECUTE') then
   raise exception 'RPC privilégiée exposée';
 end if;
 perform pg_temp.expect_denied(member_id,null,'create_workspace','{"name":"interdit"}');
 ws := (public.studio_execute(owner_id,null,'create_workspace','{"name":"A"}')->'workspace'->>'id')::uuid;
 other_ws := (public.studio_execute(other_id,null,'create_workspace','{"name":"B"}')->'workspace'->>'id')::uuid;
 perform pg_temp.expect_denied(other_id,ws,'overview');
 perform pg_temp.expect_denied(owner_id,other_ws,'checks');
 inv := (public.studio_execute(owner_id,ws,'invite',jsonb_build_object('email','studio-admin@example.test','role','admin','token_hash',repeat('a',64)))->'invitation'->>'id')::uuid;
 -- Un autre email ne peut pas accepter même avec le bon jeton.
 perform pg_temp.expect_denied(member_id,null,'accept_invitation',jsonb_build_object('token_hash',repeat('a',64)));
 perform public.studio_execute(admin_id,null,'accept_invitation',jsonb_build_object('token_hash',repeat('a',64)));
 perform pg_temp.expect_denied(admin_id,null,'accept_invitation',jsonb_build_object('token_hash',repeat('a',64)));
 perform pg_temp.expect_denied(admin_id,ws,'set_role',jsonb_build_object('user_id',owner_id,'role','member'));
 perform pg_temp.expect_denied(admin_id,ws,'invite',jsonb_build_object('email','studio-member@example.test','role','admin','token_hash',repeat('b',64)));
 inv := (public.studio_execute(admin_id,ws,'invite',jsonb_build_object('email','studio-member@example.test','role','member','token_hash',repeat('b',64)))->'invitation'->>'id')::uuid;
 update public.workspace_invitations set expires_at=now()-interval '1 second' where id=inv;
 perform pg_temp.expect_denied(member_id,null,'accept_invitation',jsonb_build_object('token_hash',repeat('b',64)));
 inv := (public.studio_execute(admin_id,ws,'invite',jsonb_build_object('email','studio-member@example.test','role','member','token_hash',repeat('c',64)))->'invitation'->>'id')::uuid;
 perform public.studio_execute(admin_id,ws,'revoke_invitation',jsonb_build_object('id',inv));
 perform pg_temp.expect_denied(member_id,null,'accept_invitation',jsonb_build_object('token_hash',repeat('c',64)));
 perform public.studio_execute(admin_id,ws,'invite',jsonb_build_object('email','studio-member@example.test','role','member','token_hash',repeat('d',64)));
 perform public.studio_execute(member_id,null,'accept_invitation',jsonb_build_object('token_hash',repeat('d',64)));
 perform pg_temp.expect_denied(member_id,ws,'create_key',jsonb_build_object('name','no','token_hash',repeat('e',64),'prefix','mc_studio_no','scopes',jsonb_build_array('checks:read')));
 perform public.studio_execute(owner_id,ws,'invite',jsonb_build_object('email','studio-five@example.test','role','member','token_hash',repeat('f',64)));
 perform public.studio_execute(owner_id,ws,'invite',jsonb_build_object('email','studio-six@example.test','role','member','token_hash',repeat('1',64)));
 perform pg_temp.expect_denied(owner_id,ws,'invite',jsonb_build_object('email','extra@example.test','role','member','token_hash',repeat('2',64)));
 perform public.studio_execute('10000000-0000-0000-0000-000000000005',null,'accept_invitation',jsonb_build_object('token_hash',repeat('f',64)));
 -- L'email non confirmé ne peut pas prendre la place réservée.
 perform pg_temp.expect_denied('10000000-0000-0000-0000-000000000006',null,'accept_invitation',jsonb_build_object('token_hash',repeat('1',64)));
 update auth.users set email_confirmed_at=now() where id='10000000-0000-0000-0000-000000000006';
 perform public.studio_execute('10000000-0000-0000-0000-000000000006',null,'accept_invitation',jsonb_build_object('token_hash',repeat('1',64)));
 if (select count(*) from public.workspace_members where workspace_id=ws)<>5 then raise exception 'Nombre de sièges incorrect'; end if;
 perform pg_temp.expect_denied(owner_id,ws,'remove_member',jsonb_build_object('user_id',owner_id));
 perform pg_temp.expect_denied(member_id,ws,'remove_member',jsonb_build_object('user_id',admin_id));
 key_id := (public.studio_execute(admin_id,ws,'create_key',jsonb_build_object('name','lecture','token_hash',repeat('3',64),'prefix','mc_studio_123456789','scopes',jsonb_build_array('checks:read')))->'key'->>'id')::uuid;
 perform pg_temp.expect_denied(other_id,other_ws,'revoke_key',jsonb_build_object('id',key_id));
 got := public.studio_execute(owner_id,ws,'overview','{}');
 if got::text like '%token_hash%' or got::text like '%'||repeat('3',64)||'%' then raise exception 'Empreinte de secret exposée'; end if;
 got := public.studio_execute_api(repeat('3',64),'checks','{}');
 if got->'items' <> '[]'::jsonb then raise exception 'Historique privé exposé'; end if;
 perform public.studio_execute(other_id,other_ws,'save_check',jsonb_build_object('caption','Publication étrangère','platform','instagram','result',jsonb_build_object('analysisMode','rules_only')));

 begin
   perform public.studio_execute_api(repeat('3',64),'save_check','{}');
   raise exception 'Scope API ignoré';
 exception when insufficient_privilege then null; end;
 got := public.studio_execute_api(repeat('3',64),'checks','{}');
 if got->'items' <> '[]'::jsonb then raise exception 'Autre équipe exposée via clé'; end if;
 -- Un administrateur rétrogradé ne peut plus accorder un accès via ses
 -- invitations encore en attente, même si le jeton avait déjà été remis.
 perform public.studio_execute(owner_id,ws,'remove_member',jsonb_build_object('user_id','10000000-0000-0000-0000-000000000005'));
 perform public.studio_execute(admin_id,ws,'invite',jsonb_build_object('email','studio-five@example.test','role','member','token_hash',repeat('6',64)));
 -- Rétrogradation retire immédiatement les clés de cet administrateur.
 perform public.studio_execute(owner_id,ws,'set_role',jsonb_build_object('user_id',admin_id,'role','member'));
 perform pg_temp.expect_denied('10000000-0000-0000-0000-000000000005',null,'accept_invitation',jsonb_build_object('token_hash',repeat('6',64)));
 begin
   perform public.studio_execute_api(repeat('3',64),'checks','{}');
   raise exception 'Clé de membre rétrogradé encore valide';
 exception when insufficient_privilege then null; end;
 -- Le retrait de l'auteur ferme également les invitations remises.
 perform public.studio_execute(owner_id,ws,'set_role',jsonb_build_object('user_id',admin_id,'role','admin'));
 perform public.studio_execute(admin_id,ws,'invite',jsonb_build_object('email','studio-five@example.test','role','member','token_hash',repeat('7',64)));
 perform public.studio_execute(owner_id,ws,'remove_member',jsonb_build_object('user_id',admin_id));
 perform pg_temp.expect_denied('10000000-0000-0000-0000-000000000005',null,'accept_invitation',jsonb_build_object('token_hash',repeat('7',64)));
 -- La suppression d'un compte non propriétaire met created_by à NULL :
 -- aucun ancien jeton ne doit redonner un accès après cette suppression.
 perform public.studio_execute(owner_id,ws,'invite',jsonb_build_object('email','studio-admin@example.test','role','admin','token_hash',repeat('8',64)));
 perform public.studio_execute(admin_id,null,'accept_invitation',jsonb_build_object('token_hash',repeat('8',64)));
 perform public.studio_execute(admin_id,ws,'invite',jsonb_build_object('email','studio-five@example.test','role','member','token_hash',repeat('9',64)));
 delete from auth.users where id=admin_id;
 perform pg_temp.expect_denied('10000000-0000-0000-0000-000000000005',null,'accept_invitation',jsonb_build_object('token_hash',repeat('9',64)));
 key_id := (public.studio_execute(owner_id,ws,'create_key',jsonb_build_object('name','owner','token_hash',repeat('4',64),'prefix','mc_studio_123456780','scopes',jsonb_build_array('checks:read')))->'key'->>'id')::uuid;
 perform public.studio_execute(owner_id,ws,'revoke_key',jsonb_build_object('id',key_id));
 begin
   perform public.studio_execute_api(repeat('4',64),'checks','{}');
   raise exception 'Clé révoquée encore valide';
 exception when insufficient_privilege then null; end;
 key_id := (public.studio_execute(owner_id,ws,'create_key',jsonb_build_object('name','expired','token_hash',repeat('5',64),'prefix','mc_studio_123456781','scopes',jsonb_build_array('checks:read')))->'key'->>'id')::uuid;
 update public.api_keys set expires_at=now()-interval '1 second' where id=key_id;
 begin
   perform public.studio_execute_api(repeat('5',64),'checks','{}');
   raise exception 'Clé expirée encore valide';
 exception when insufficient_privilege then null; end;
 perform public.studio_execute(owner_id,ws,'save_check',jsonb_build_object('caption','Texte partagé équipe A','platform','instagram','result',jsonb_build_object('analysisMode','rules_only')));
 -- Vérifier explicitement le quota partagé sur toutes les clés API de l'espace.
 key_id := (public.studio_execute(owner_id,ws,'create_key',
   jsonb_build_object('name','quota','token_hash',repeat('e',64),
    'prefix','mc_studio_quota','scopes',jsonb_build_array('checks:write')))->'key'->>'id')::uuid;
 update public.studio_api_usage_monthly set checks_used=1999
   where workspace_id=ws and period_start=date_trunc('month',timezone('UTC',now()))::date;
 if not found then
   insert into public.studio_api_usage_monthly(workspace_id,period_start,checks_used)
   values(ws,date_trunc('month',timezone('UTC',now()))::date,1999);
 end if;
 perform public.studio_execute_api(repeat('e',64),'save_check',
   '{"caption":"Contrôle API sans IA","platform":"instagram","result":{"analysisMode":"rules_only"}}');
 if (select checks_used from public.studio_api_usage_monthly
    where workspace_id=ws and period_start=date_trunc('month',timezone('UTC',now()))::date)<>2000
 then raise exception 'Le dernier contrôle API n a pas été compté'; end if;
 begin
   perform public.studio_execute_api(repeat('e',64),'save_check',
      '{"caption":"Quota dépassé","platform":"instagram","result":{"analysisMode":"rules_only"}}');
   raise exception 'Le plafond API 2k a été dépassé' using errcode='XX000';
 exception when raise_exception then
   -- Uniquement le refus levé par le garde-fou SQL, pas une erreur de notre fixture.
   if SQLERRM<>'Quota API Studio atteint' then raise; end if;
 end;
 update public.subscriptions set current_period_end=now()-interval '1 second'
   where user_id=owner_id;
 begin
  perform public.studio_execute_api(repeat('e',64),'checks','{}');
  raise exception 'API exposée malgré expiration Studio';
 exception when insufficient_privilege then null; end;
 update public.subscriptions set current_period_end=now()+interval '30 days'
   where user_id=owner_id;
 if has_table_privilege('authenticated','public.studio_api_usage_monthly','select')
    or has_table_privilege('anon','public.studio_api_usage_monthly','select')
    or has_function_privilege('authenticated','studio_private.has_active_studio_subscription(uuid)','execute')
 then raise exception 'Compteur API ou helper privilégié exposé'; end if;
 update public.users set plan='solo' where id=owner_id;
 perform pg_temp.expect_denied(owner_id,ws,'checks');
 perform pg_temp.expect_denied(member_id,ws,'overview');
 -- Une équipe supprimée localement ne laisse aucune capacité utilisable.
 perform public.studio_execute(other_id,other_ws,'invite',jsonb_build_object('email','studio-five@example.test','role','member','token_hash',repeat('ab',32)));
 perform public.studio_execute(other_id,other_ws,'create_key',jsonb_build_object('name','deleted-workspace','token_hash',repeat('cd',32),'prefix','mc_studio_123456782','scopes',jsonb_build_array('checks:read')));
 delete from public.workspaces where id=other_ws;
 perform pg_temp.expect_denied('10000000-0000-0000-0000-000000000005',null,'accept_invitation',jsonb_build_object('token_hash',repeat('ab',32)));
 begin
   perform public.studio_execute_api(repeat('cd',32),'checks','{}');
   raise exception 'Clé équipe supprimée encore valide';
 exception when insufficient_privilege then null; end;
 if exists(select 1 from public.workspace_members where workspace_id=other_ws)
 or exists(select 1 from public.workspace_invitations where workspace_id=other_ws)
 or exists(select 1 from public.api_keys where workspace_id=other_ws)
 or exists(select 1 from public.workspace_verifications where workspace_id=other_ws) then
  raise exception 'Données orphelines après suppression équipe';
 end if;
end $$;
-- Restaurer le plan fixture pour tester l'isolation RLS d'une équipe active,
-- et non un déni global dû au downgrade précédent.
update public.users set plan='studio' where id='10000000-0000-0000-0000-000000000001';
-- RLS : session de B, les lignes de A ne doivent pas apparaître.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
do $$ begin
 if exists(select 1 from public.workspaces where owner_id='10000000-0000-0000-0000-000000000001')
 or exists(select 1 from public.workspace_members where user_id='10000000-0000-0000-0000-000000000004')
 or exists(select 1 from public.workspace_verifications) then
  raise exception 'Fuite RLS multi-tenant';
 end if;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
do $$ begin
 if not exists(select 1 from public.workspaces where owner_id='10000000-0000-0000-0000-000000000001')
 or not exists(select 1 from public.workspace_verifications) then
  raise exception 'RLS bloque aussi le propriétaire autorisé';
 end if;
end $$;
rollback;
