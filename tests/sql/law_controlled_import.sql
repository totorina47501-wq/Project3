-- Corpus synthétique en transaction annulée ; aucun article réel importé.
begin;
-- Le harnais pgvector omet cette colonne : seul son cycle d'invalidation est testé ici.
alter table public.law_documents add column if not exists embedding text;
do $$ declare manifest jsonb; expected jsonb; result jsonb; changed jsonb; begin
 if has_function_privilege('authenticated','public.import_approved_law_documents(jsonb,jsonb)','EXECUTE') or
    has_function_privilege('anon','public.import_approved_law_documents(jsonb,jsonb)','EXECUTE') then
   raise exception 'Import accessible côté client'; end if;
 if not has_function_privilege('service_role','public.import_approved_law_documents(jsonb,jsonb)','EXECUTE') then
   raise exception 'Import opérateur inaccessible'; end if;
 if has_table_privilege('authenticated','public.law_import_runs','SELECT') or
    has_table_privilege('service_role','public.law_import_runs','INSERT') then
   raise exception 'Journal modifiable ou exposé'; end if;
 manifest:=jsonb_build_object('schemaVersion',1,'status','approved_for_manual_import','documents',jsonb_build_array(jsonb_build_object(
   'article_ref','SQL-IMPORT-TEST','content','Texte fictif de test de validation transactionnelle.',
   'source_url','https://www.legifrance.gouv.fr/loda/id/SQL-IMPORT-TEST','effective_on','2026-11-05',
   'content_sha256',encode(extensions.digest('Texte fictif de test de validation transactionnelle.','sha256'),'hex'),
   'source_sha256',repeat('a',64),'reviewed_by','Test local','reviewed_at','2026-11-05T12:00:00Z')));
 expected:='[{"article_ref":"SQL-IMPORT-TEST","exists":false}]'::jsonb;
 result:=public.import_approved_law_documents(manifest,expected);
 if result->>'inserted'<>'1' or result->>'alreadyApplied'<>'false' then raise exception 'Insertion absente'; end if;
 update public.law_documents set embedding='fixture-vector' where article_ref='SQL-IMPORT-TEST';
 result:=public.import_approved_law_documents(manifest,expected);
 if result->>'alreadyApplied'<>'true' or result->>'inserted'<>'0' or
    (select embedding from public.law_documents where article_ref='SQL-IMPORT-TEST')<>'fixture-vector' then
   raise exception 'Rejeu non idempotent'; end if;
 if (select count(*) from public.law_import_runs where manifest_sha256=result->>'manifestSha256')<>1 then
   raise exception 'Audit dupliqué'; end if;
 changed:=jsonb_set(manifest,'{documents,0,reviewed_by}','"Nouvelle revue"');
 begin
   perform public.import_approved_law_documents(changed,expected);
   raise exception 'Écrasement concurrent accepté' using errcode='XX000';
 exception when serialization_failure then null; end;
 expected:=jsonb_build_array(jsonb_build_object('article_ref','SQL-IMPORT-TEST','exists',true,
  'content',manifest#>>'{documents,0,content}','source_url',manifest#>>'{documents,0,source_url}','effective_on','2026-11-05'));
 result:=public.import_approved_law_documents(changed,expected);
 if result->>'unchanged'<>'1' or (select embedding from public.law_documents where article_ref='SQL-IMPORT-TEST')<>'fixture-vector' then
  raise exception 'Contenu inchangé réindexé'; end if;
 changed:=jsonb_set(changed,'{documents,0,content}','"Texte fictif modifié pour imposer une réindexation contrôlée."');
 changed:=jsonb_set(changed,'{documents,0,content_sha256}',to_jsonb(encode(extensions.digest(changed#>>'{documents,0,content}','sha256'),'hex')));
 result:=public.import_approved_law_documents(changed,expected);
 if result->>'updated'<>'1' or (select embedding from public.law_documents where article_ref='SQL-IMPORT-TEST') is not null then
  raise exception 'Vecteur périmé conservé'; end if;
 -- Le second document invalide doit annuler toute l'opération.
 changed:=jsonb_set(changed,'{documents,0,article_ref}','"ATOMIC-NEW"');
 changed:=jsonb_set(changed,'{documents}',(changed->'documents')||jsonb_build_array(jsonb_set(changed#>'{documents,0}','{article_ref}','"INVALID-NEW"')));
 changed:=jsonb_set(changed,'{documents,1,content_sha256}',to_jsonb(repeat('0',64)));
 begin
  perform public.import_approved_law_documents(changed,'[{"article_ref":"ATOMIC-NEW","exists":false},{"article_ref":"INVALID-NEW","exists":false}]');
  raise exception 'Manifeste forgé accepté' using errcode='XX000';
 exception when invalid_parameter_value then null; end;
 if exists(select 1 from public.law_documents where article_ref in ('ATOMIC-NEW','INVALID-NEW')) then
  raise exception 'Écriture partielle conservée'; end if;
end $$;
rollback;
