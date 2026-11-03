-- Chemin : tests/sql/security_smoke.sql
-- Exécuter avec la connexion SQL d'administration après les migrations.
-- Aucun enregistrement applicatif n'est créé.
begin;
do $$
declare
  expected_table text;
  rule_count integer;
  document_count integer;
  public_granted boolean;
  protected_tables text[] := array[
    'users','social_accounts','verifications','ai_analyses',
    'compliance_rules','brand_deals','assistant_conversations',
    'subscriptions','law_documents','usage_monthly','rewrite_feedback'
  ];
begin
  foreach expected_table in array protected_tables loop
    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = expected_table
        and c.relkind = 'r' and c.relrowsecurity
    ) then
      raise exception 'RLS absent ou table manquante : %', expected_table;
    end if;
  end loop;

  select count(*) into rule_count from public.compliance_rules
  where code in ('R1','R2','R3','R4','R5','R6','R7','R8');
  if rule_count <> 8 then
    raise exception 'Règles attendues : 8, reçues : %', rule_count;
  end if;

  select count(*) into document_count from public.law_documents;
  if document_count < 5 then
    raise exception 'Sources juridiques attendues : au moins 5';
  end if;

  select has_function_privilege(
    'anon',
    'public.match_law_documents(extensions.vector, integer, double precision)',
    'execute'
  ) into public_granted;
  if public_granted then
    raise exception 'Recherche RAG accessible au rôle anonyme';
  end if;

  if has_table_privilege('authenticated', 'public.law_documents', 'insert') then
    raise exception 'Écriture de sources juridiques exposée aux utilisateurs';
  end if;

  if has_column_privilege('authenticated', 'public.users', 'plan', 'update') then
    raise exception 'Plan tarifaire modifiable par le navigateur';
  end if;

  if has_column_privilege('authenticated', 'public.social_accounts',
     'access_token_vault_id', 'select') then
    raise exception 'Identifiant Vault exposé au navigateur';
  end if;
end;
$$;
rollback;
