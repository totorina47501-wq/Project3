-- MentionCheck: demander et suivre un effacement RGPD sans supprimer quoi que ce soit.
-- Workflow opérateur non encore implémenté; aucun objet Storage/Auth n'est effacé.
begin;
create table if not exists public.privacy_erasure_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'requested'
    check (status in ('requested','reviewing','cancelled','completed','rejected')),
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  constraint privacy_request_cancelled_consistent check (
    (status = 'cancelled' and cancelled_at is not null)
    or (status <> 'cancelled' and cancelled_at is null)
  )
);
create unique index if not exists erasure_one_active_request_per_user
  on public.privacy_erasure_requests(user_id)
  where status in ('requested','reviewing');
create index if not exists erasure_user_recent
  on public.privacy_erasure_requests(user_id, requested_at desc);
alter table public.privacy_erasure_requests enable row level security;
revoke all on public.privacy_erasure_requests from public, anon, authenticated;
grant select (id,user_id,status,requested_at,updated_at,cancelled_at)
  on public.privacy_erasure_requests to authenticated;
create policy privacy_erasure_select_own on public.privacy_erasure_requests
  for select to authenticated using ((select auth.uid()) = user_id);
comment on table public.privacy_erasure_requests is
  'Dossier de demande RGPD : aucune suppression automatique. Effacement effectif soumis a une procedure distincte.';
commit;
