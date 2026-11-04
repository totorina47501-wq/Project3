-- Lecture seule, réservée à un opérateur autorisé ; ne jamais exposer par RPC.
-- Exécuter dans une transaction cohérente pour figer consentements et demandes.
begin transaction isolation level repeatable read read only;
with candidates as (
  select f.id, f.user_id, f.original_caption, f.accepted_caption,
    f.prompt_version, f.accepted_at, f.training_consent_snapshot,
    u.ai_training_opt_in as current_training_consent,
    exists (
      select 1 from public.privacy_erasure_requests r
      where r.user_id=f.user_id and r.status in ('requested','reviewing','completed')
    ) as erasure_requested,
    -- La relecture ne peut pas être déduite de l'acceptation par le créateur.
    false as review_approved
  from public.rewrite_feedback f
  join public.users u on u.id=f.user_id
  where f.training_consent_snapshot and u.ai_training_opt_in
  order by f.accepted_at, f.id
  -- Une ligne de trop provoque un refus explicite plutôt qu'un export tronqué.
  limit 10001
)
select jsonb_build_object(
  'captured_at', current_timestamp,
  'rows', coalesce(jsonb_agg(to_jsonb(candidates) order by accepted_at,id), '[]'::jsonb)
) from candidates;
commit;
