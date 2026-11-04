-- Chemin : supabase/migrations/202611032002_rls_and_functions.sql
-- Permissions minimales : Auth/Supabase doit gérer les sessions, le backend les écritures IA.
begin;

-- Créer automatiquement le profil applicatif lors d'une inscription Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.email is not null then
    insert into public.users (id, email)
    values (new.id, new.email)
    on conflict (id) do update
      set email = excluded.email, updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email on auth.users
for each row execute function public.handle_new_user();

-- Synchroniser les profils déjà présents sans modifier les abonnements.
insert into public.users (id, email)
select id, email from auth.users where email is not null
on conflict (id) do update set email = excluded.email, updated_at = now();

create or replace function public.touch_updated_at()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_updated_at before update on public.users
for each row execute function public.touch_updated_at();
create trigger verifications_updated_at before update on public.verifications
for each row execute function public.touch_updated_at();
create trigger assistant_conversations_updated_at before update on public.assistant_conversations
for each row execute function public.touch_updated_at();
create trigger subscriptions_updated_at before update on public.subscriptions
for each row execute function public.touch_updated_at();
create trigger usage_monthly_updated_at before update on public.usage_monthly
for each row execute function public.touch_updated_at();
create trigger law_documents_updated_at before update on public.law_documents
for each row execute function public.touch_updated_at();

-- Une vérification déjà finalisée conserve ses entrées et son empreinte initiales.
create or replace function public.prevent_verification_evidence_update()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  if old.status in ('completed', 'accepted', 'kept') and (
    old.user_id is distinct from new.user_id
    or old.platform is distinct from new.platform
    or old.content_text is distinct from new.content_text
    or old.media_url is distinct from new.media_url
    or old.media_type is distinct from new.media_type
    or old.hash_sha256 is distinct from new.hash_sha256
    or old.created_at is distinct from new.created_at
  ) then
    raise exception 'Les éléments probatoires finalisés sont immuables';
  end if;
  return new;
end;
$$;
create trigger verifications_evidence_immutable
before update on public.verifications
for each row execute function public.prevent_verification_evidence_update();

-- Les contrats archivés restent immuables, sauf suppression RGPD du compte.
create or replace function public.prevent_archived_deal_update()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  if old.archived_at is not null and (
    old.user_id is distinct from new.user_id
    or old.brand_name is distinct from new.brand_name
    or old.start_date is distinct from new.start_date
    or old.end_date is distinct from new.end_date
    or old.contract_url is distinct from new.contract_url
    or old.hash_sha256 is distinct from new.hash_sha256
    or old.archived_at is distinct from new.archived_at
  ) then
    raise exception 'La preuve de collaboration archivée est immuable';
  end if;
  return new;
end;
$$;
create trigger brand_deals_archive_immutable
before update on public.brand_deals
for each row execute function public.prevent_archived_deal_update();

alter table public.users enable row level security;
alter table public.social_accounts enable row level security;
alter table public.verifications enable row level security;
alter table public.ai_analyses enable row level security;
alter table public.compliance_rules enable row level security;
alter table public.brand_deals enable row level security;
alter table public.assistant_conversations enable row level security;
alter table public.subscriptions enable row level security;
alter table public.law_documents enable row level security;
alter table public.usage_monthly enable row level security;
alter table public.rewrite_feedback enable row level security;

-- Supprimer les autorisations implicites puis accorder uniquement les colonnes utiles.
revoke all on
  public.users, public.social_accounts, public.verifications,
  public.ai_analyses, public.compliance_rules, public.brand_deals,
  public.assistant_conversations, public.subscriptions, public.law_documents,
  public.usage_monthly, public.rewrite_feedback
from public, anon, authenticated;

grant select (id, email, plan, created_at, ai_training_opt_in, updated_at)
  on public.users to authenticated;
grant update (ai_training_opt_in)
  on public.users to authenticated;
grant select (id, user_id, platform, handle, connected_at)
  on public.social_accounts to authenticated;
grant select on public.verifications to authenticated;
grant select (
  id, verification_id, stage, model_used, prompt_tokens, completion_tokens,
  latency_ms, cost_usd, created_at
) on public.ai_analyses to authenticated;
grant select on public.compliance_rules to authenticated;
grant select on public.brand_deals to authenticated;
grant select on public.assistant_conversations to authenticated;
grant select on public.subscriptions to authenticated;
grant select on public.usage_monthly to authenticated;
grant select (id, verification_id, accepted_at)
  on public.rewrite_feedback to authenticated;
-- law_documents et les réponses brutes d'IA restent accessibles uniquement au backend.

create policy users_select_own on public.users
  for select to authenticated using ((select auth.uid()) = id);
create policy users_update_consent_own on public.users
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy social_accounts_select_own on public.social_accounts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy verifications_select_own on public.verifications
  for select to authenticated using ((select auth.uid()) = user_id);
create policy ai_analyses_select_own on public.ai_analyses
  for select to authenticated using (
    exists (
      select 1 from public.verifications v
      where v.id = verification_id and v.user_id = (select auth.uid())
    )
  );
create policy compliance_rules_read on public.compliance_rules
  for select to authenticated using (is_active);
create policy brand_deals_select_own on public.brand_deals
  for select to authenticated using ((select auth.uid()) = user_id);
create policy assistant_conversations_select_own on public.assistant_conversations
  for select to authenticated using ((select auth.uid()) = user_id);
create policy subscriptions_select_own on public.subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy usage_monthly_select_own on public.usage_monthly
  for select to authenticated using ((select auth.uid()) = user_id);
create policy rewrite_feedback_select_own on public.rewrite_feedback
  for select to authenticated using ((select auth.uid()) = user_id);

-- Aucun utilisateur ne peut écrire directement un résultat IA, une facture, un
-- compteur, une trace d'analyse ou une source légale. Les API utilisent le
-- service_role UNIQUEMENT côté serveur après vérification de la session.
-- Le service_role Supabase possède BYPASSRLS (ne jamais le publier).

-- Restreindre les fonctions appelées par des triggers aux propriétaires.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.prevent_verification_evidence_update()
  from public, anon, authenticated;
revoke all on function public.prevent_archived_deal_update()
  from public, anon, authenticated;

-- Buckets privés avec upload au chemin userId/uuid.ext.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'verification-media', 'verification-media', false, 52428800,
  array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime']
)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'deal-contracts', 'deal-contracts', false, 10485760,
  array['application/pdf']
)
on conflict (id) do nothing;

-- L'accès aux objets est limité aux chemins appartenant au même utilisateur.
create policy mentioncheck_media_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'verification-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy mentioncheck_media_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'verification-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy mentioncheck_contract_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'deal-contracts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy mentioncheck_contract_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'deal-contracts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

commit;
