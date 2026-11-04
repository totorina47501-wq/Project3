-- Chemin : supabase/migrations/202611032003_pgvector_match.sql
-- Fonction de recherche pour Mia. Non exposée aux sessions navigateur.
begin;

create or replace function public.match_law_documents(
  query_embedding extensions.vector(1536),
  match_count integer default 5,
  min_similarity double precision default 0.0
)
returns table (
  id uuid,
  article_ref text,
  content text,
  source_url text,
  similarity double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    d.id,
    d.article_ref,
    d.content,
    d.source_url,
    (1.0 - (d.embedding operator(extensions.<=>) query_embedding))::double precision
      as similarity
  from public.law_documents d
  where d.embedding is not null
    and (1.0 - (d.embedding operator(extensions.<=>) query_embedding))
      >= greatest(-1.0, least(1.0, min_similarity))
  order by d.embedding operator(extensions.<=>) query_embedding
  limit greatest(1, least(10, match_count));
$$;

revoke all on function public.match_law_documents(
  extensions.vector(1536), integer, double precision
) from public, anon, authenticated;

grant execute on function public.match_law_documents(
  extensions.vector(1536), integer, double precision
) to service_role;

-- Les index et dimensions reposent sur text-embedding-3-small (1536).
-- L'embedding de chaque article est créé par le script d'indexation du bloc 7.
-- Aucune invocation de l'API OpenAI depuis PostgreSQL.

commit;
