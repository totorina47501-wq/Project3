-- Import manuel traçable et atomique : aucune collecte ni indexation payante implicite.
alter table public.law_documents
 add column if not exists content_sha256 text,
 add column if not exists source_sha256 text,
 add column if not exists reviewed_by text,
 add column if not exists reviewed_at timestamptz;

create table public.law_import_runs (
 id uuid primary key default gen_random_uuid(),
 manifest_sha256 text not null unique check(manifest_sha256 ~ '^[a-f0-9]{64}$'),
 manifest jsonb not null,
 inserted_count integer not null check(inserted_count>=0),
 updated_count integer not null check(updated_count>=0),
 unchanged_count integer not null check(unchanged_count>=0),
 imported_at timestamptz not null default now()
);
alter table public.law_import_runs enable row level security;
revoke all on public.law_import_runs from public,anon,authenticated,service_role;
grant select on public.law_import_runs to service_role;

create or replace function public.import_approved_law_documents(p_manifest jsonb,p_expected jsonb)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare
 v_doc jsonb; v_expected jsonb; v_field text; v_ref text; v_refs text[]:='{}';
 v_content text; v_url text; v_date date; v_reviewed_at timestamptz;
 v_existing public.law_documents%rowtype; v_found boolean;
 v_digest text; v_run public.law_import_runs%rowtype;
 v_inserted integer:=0; v_updated integer:=0; v_unchanged integer:=0;
 v_index integer:=0; v_new integer:=0;
begin
 if p_manifest is null or jsonb_typeof(p_manifest) is distinct from 'object' or
    p_manifest->>'schemaVersion' is distinct from '1' or
    p_manifest->>'status' is distinct from 'approved_for_manual_import' or
    jsonb_typeof(p_manifest->'documents') is distinct from 'array' or
    jsonb_typeof(p_expected) is distinct from 'array' then
  raise exception 'Manifeste approuvé et snapshot requis' using errcode='22023'; end if;
 if jsonb_array_length(p_manifest->'documents') not between 1 and 500 or
    jsonb_array_length(p_expected)<>jsonb_array_length(p_manifest->'documents') or
    octet_length(p_manifest::text)>2000000 or octet_length(p_expected::text)>3000000 then
  raise exception 'Import hors limites' using errcode='22023'; end if;
 -- Validation intégrale avant le premier verrou ou la première écriture.
 for v_doc in select value from jsonb_array_elements(p_manifest->'documents') loop
  if jsonb_typeof(v_doc) is distinct from 'object' then
   raise exception 'Document invalide' using errcode='22023'; end if;
  foreach v_field in array array['article_ref','content','source_url','effective_on','content_sha256','source_sha256','reviewed_by','reviewed_at'] loop
   if jsonb_typeof(v_doc->v_field) is distinct from 'string' then
    raise exception 'Champ de validation manquant' using errcode='22023'; end if;
  end loop;
  v_ref:=v_doc->>'article_ref'; v_content:=v_doc->>'content'; v_url:=v_doc->>'source_url';
  if v_ref !~ '^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$' or v_ref=any(v_refs) or
     length(v_content) not between 20 and 2000 or v_content<>btrim(v_content,E' \t\r\n') or
     v_url !~ '^https://(www\.legifrance\.gouv\.fr|www\.economie\.gouv\.fr)/[^[:space:]]*$' or
     v_doc->>'content_sha256' !~ '^[a-f0-9]{64}$' or v_doc->>'source_sha256' !~ '^[a-f0-9]{64}$' or
     v_doc->>'content_sha256'<>encode(extensions.digest(convert_to(v_content,'UTF8'),'sha256'),'hex') or
     length(btrim(v_doc->>'reviewed_by')) not between 3 and 120 or
     v_doc->>'effective_on' !~ '^\d{4}-\d{2}-\d{2}$' then
   raise exception 'Document non approuvé ou empreinte invalide' using errcode='22023'; end if;
  begin
   v_date:=(v_doc->>'effective_on')::date;
   v_reviewed_at:=(v_doc->>'reviewed_at')::timestamptz;
   if not isfinite(v_date) or not isfinite(v_reviewed_at) or to_char(v_date,'YYYY-MM-DD')<>v_doc->>'effective_on' then
    raise exception 'Date invalide'; end if;
  exception when others then raise exception 'Dates de revue invalides' using errcode='22023'; end;
  v_expected:=p_expected->v_index;
  if jsonb_typeof(v_expected) is distinct from 'object' or
     v_expected->>'article_ref' is distinct from v_ref or
     jsonb_typeof(v_expected->'exists') is distinct from 'boolean' then
   raise exception 'Snapshot non cohérent' using errcode='22023'; end if;
  v_refs:=array_append(v_refs,v_ref); v_index:=v_index+1;
 end loop;
 v_digest:=encode(extensions.digest(convert_to(p_manifest::text,'UTF8'),'sha256'),'hex');
 -- Ce verrou sérialise l'import avec toute écriture concurrente du corpus.
 lock table public.law_documents in share row exclusive mode;
 select * into v_run from public.law_import_runs where manifest_sha256=v_digest;
 if found then
  return jsonb_build_object('runId',v_run.id,'manifestSha256',v_digest,'alreadyApplied',true,
   'inserted',0,'updated',0,'unchanged',jsonb_array_length(p_manifest->'documents'));
 end if;
 -- Comparaison de toutes les références avant toute modification (CAS).
 v_index:=0;
 for v_doc in select value from jsonb_array_elements(p_manifest->'documents') loop
  v_expected:=p_expected->v_index;
  select * into v_existing from public.law_documents where article_ref=v_doc->>'article_ref';
  v_found:=found;
  if v_found is distinct from (v_expected->>'exists')::boolean or
     (v_found and (v_existing.content is distinct from v_expected->>'content' or
      v_existing.source_url is distinct from v_expected->>'source_url' or
      to_jsonb(v_existing.effective_on) is distinct from nullif(v_expected->'effective_on','null'::jsonb))) then
   raise exception 'Corpus modifié depuis le plan' using errcode='40001'; end if;
  if v_found and v_existing.source_url is distinct from v_doc->>'source_url' then
   raise exception 'Source existante immuable' using errcode='22023'; end if;
  if not v_found then v_new:=v_new+1; end if;
  v_index:=v_index+1;
 end loop;
 if (select count(*) from public.law_documents)+v_new>1000 then
  raise exception 'Corpus limité à 1000 documents' using errcode='22023'; end if;
 for v_doc in select value from jsonb_array_elements(p_manifest->'documents') loop
  select * into v_existing from public.law_documents where article_ref=v_doc->>'article_ref';
  if not found then
   insert into public.law_documents(article_ref,content,source_url,effective_on,content_sha256,source_sha256,reviewed_by,reviewed_at)
    values(v_doc->>'article_ref',v_doc->>'content',v_doc->>'source_url',(v_doc->>'effective_on')::date,
     v_doc->>'content_sha256',v_doc->>'source_sha256',v_doc->>'reviewed_by',(v_doc->>'reviewed_at')::timestamptz);
   v_inserted:=v_inserted+1;
  elsif v_existing.content is not distinct from v_doc->>'content' and
        v_existing.effective_on is not distinct from (v_doc->>'effective_on')::date then
   -- Pas même une mise à jour : vecteurs et horodatages inchangés sont préservés.
   v_unchanged:=v_unchanged+1;
  else
   update public.law_documents set content=v_doc->>'content',effective_on=(v_doc->>'effective_on')::date,
    content_sha256=v_doc->>'content_sha256',source_sha256=v_doc->>'source_sha256',
    reviewed_by=v_doc->>'reviewed_by',reviewed_at=(v_doc->>'reviewed_at')::timestamptz,checked_at=now(),updated_at=now()
    where article_ref=v_doc->>'article_ref';
   -- Le trigger existant invalide le vecteur uniquement si le texte a changé.
   v_updated:=v_updated+1;
  end if;
 end loop;
 insert into public.law_import_runs(manifest_sha256,manifest,inserted_count,updated_count,unchanged_count)
  values(v_digest,p_manifest,v_inserted,v_updated,v_unchanged) returning * into v_run;
 return jsonb_build_object('runId',v_run.id,'manifestSha256',v_digest,'alreadyApplied',false,
  'inserted',v_inserted,'updated',v_updated,'unchanged',v_unchanged);
end;
$$;
revoke all on function public.import_approved_law_documents(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.import_approved_law_documents(jsonb,jsonb) to service_role;
