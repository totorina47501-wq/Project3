-- Base LOCALE jetable uniquement ; ON_ERROR_STOP=1. Aucune exécution distante.
-- Requiert schéma initial, RLS et complément collaborations. Toutes écritures annulées.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('20000000-0000-0000-0000-000000000001','deal-owner@example.test',now()),
 ('20000000-0000-0000-0000-000000000002','deal-other@example.test',now());
insert into public.verifications(id,user_id,platform,content_text,status,ai_score,ai_risk_level,hash_sha256) values
 ('21000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','instagram','Publicité — texte été','completed',90,'low',repeat('a',64)),
 ('21000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','instagram','Autre utilisateur','completed',90,'low',repeat('b',64)),
 ('21000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000001','instagram','En cours','processing',null,null,null);
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
do $$ begin
 if has_function_privilege('anon','public.archive_brand_deal(uuid)','execute')
 or has_function_privilege('anon','public.save_brand_deal(uuid,text,date,date,text,uuid[])','execute')
 or has_table_privilege('authenticated','public.brand_deals','update')
 or has_table_privilege('authenticated','public.brand_deals','delete')
 or has_table_privilege('authenticated','public.brand_deal_verifications','insert') then
  raise exception 'Privilèges excessifs sur collaborations';
 end if;
end $$;
set local role authenticated;
do $$
declare deal_id uuid; pending_id uuid; original public.brand_deals; repeated public.brand_deals;
begin
 begin
  perform public.save_brand_deal(null,'Étranger','2026-11-04',null,null,array['21000000-0000-0000-0000-000000000002'::uuid]);
  raise exception 'Vérification étrangère acceptée' using errcode='XX000';
 exception when invalid_parameter_value then null; end;
 deal_id:=public.save_brand_deal(null,'Marque été','2026-11-04',null,null,array['21000000-0000-0000-0000-000000000001'::uuid]);
 perform public.save_brand_deal(deal_id,'Marque modifiée','2026-11-04','2026-11-05',null,array['21000000-0000-0000-0000-000000000001'::uuid]);
 perform set_config('mentioncheck.test_deal',deal_id::text,true);
 original:=public.archive_brand_deal(deal_id);
 repeated:=public.archive_brand_deal(deal_id);
 if original.archived_at is null or original.archive_payload is null
 or original.hash_sha256 is distinct from repeated.hash_sha256
 or original.archived_at is distinct from repeated.archived_at then
  raise exception 'Archivage absent ou non idempotent';
 end if;
 begin
  perform public.save_brand_deal(deal_id,'Altérée','2026-11-04',null,null,'{}');
  raise exception 'Archive modifiable' using errcode='XX000';
 exception when check_violation then null; end;
 begin
  perform public.delete_brand_deal_draft(deal_id);
  raise exception 'Archive supprimable par propriétaire' using errcode='XX000';
 exception when check_violation then null; end;
 pending_id:=public.save_brand_deal(null,'Non finalisée','2026-11-04',null,null,array['21000000-0000-0000-0000-000000000003'::uuid]);
 begin
  perform public.archive_brand_deal(pending_id);
  raise exception 'Contrôle non finalisé accepté' using errcode='XX000';
 exception when check_violation then null; end;
 perform public.delete_brand_deal_draft(pending_id);
 if exists(select 1 from public.brand_deals where id=pending_id) then raise exception 'Brouillon non supprimé'; end if;
end $$;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
do $$ begin
 begin
  perform public.archive_brand_deal(current_setting('mentioncheck.test_deal')::uuid);
  raise exception 'Archive étrangère exposée par RPC' using errcode='XX000';
 exception when no_data_found then null; end;
 begin
  perform public.delete_brand_deal_draft(current_setting('mentioncheck.test_deal')::uuid);
  raise exception 'Archive étrangère supprimable par RPC' using errcode='XX000';
 exception when no_data_found then null; end;
 if exists(select 1 from public.brand_deals where user_id='20000000-0000-0000-0000-000000000001')
 or exists(select 1 from public.brand_deal_verifications where user_id='20000000-0000-0000-0000-000000000001') then
  raise exception 'Fuite RLS entre comptes';
 end if;
end $$;
reset role;
do $$
declare archived public.brand_deals;
begin
 if encode(extensions.digest(convert_to(jsonb_build_array('mentioncheck-deal-v1','Été',null,jsonb_build_array('id','abc'))::text,'UTF8'),'sha256'),'hex')<>'750d95ceb386857c1a8095db493b8b2aa7d3d397ec750ae927b2f2ec3a0fc674' then
  raise exception 'Divergence de canonicalisation JS/PostgreSQL';
 end if;
 select * into archived from public.brand_deals where user_id='20000000-0000-0000-0000-000000000001' and archived_at is not null;
 if archived.hash_sha256<>encode(extensions.digest(convert_to(archived.archive_payload::text,'UTF8'),'sha256'),'hex') then
  raise exception 'Empreinte ne correspond pas au snapshot canonique';
 end if;
 begin
  update public.brand_deals set created_at=created_at+interval '1 second' where id=archived.id;
  raise exception 'Date archive modifiable' using errcode='XX000';
 exception when check_violation then null; end;
 begin
  delete from public.brand_deal_verifications where deal_id=archived.id;
  raise exception 'Liens archive modifiables' using errcode='XX000';
 exception when check_violation then null; end;
end $$;
rollback;
