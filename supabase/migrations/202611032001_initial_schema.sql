-- Chemin : supabase/migrations/202611032001_initial_schema.sql
-- MentionCheck - Schéma applicatif Supabase (UTC, UUID, données privées).
-- Les mots de passe sont gérés exclusivement par auth.users (Supabase Auth).
begin;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema extensions;

create type public.account_plan as enum ('solo', 'pro', 'studio');
create type public.social_platform as enum ('instagram', 'tiktok', 'youtube', 'linkedin');
create type public.risk_level as enum ('low', 'medium', 'high', 'critical');
create type public.verification_status as enum (
  'queued', 'processing', 'completed', 'accepted', 'kept', 'failed'
);
create type public.rule_severity as enum ('info', 'low', 'medium', 'high', 'critical');
create type public.rule_kind as enum ('legal', 'heuristic', 'technical');
create type public.subscription_status as enum (
  'incomplete', 'incomplete_expired', 'trialing', 'active',
  'past_due', 'canceled', 'unpaid', 'paused'
);

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null check (length(email) between 3 and 320),
  -- Colonne de compatibilité demandée : jamais alimentée (Auth conserve le hash).
  password_hash text null check (password_hash is null),
  plan public.account_plan not null default 'solo',
  stripe_customer_id text unique,
  ai_training_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index users_email_lower_uidx on public.users (lower(email));
comment on column public.users.password_hash is
  'Interdit de stocker des identifiants ici : Supabase Auth gère seul les mots de passe.';

create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  platform public.social_platform not null,
  handle text not null check (length(handle) between 1 and 200),
  -- UUID d'un secret conservé dans Supabase Vault, jamais le token en clair.
  access_token_vault_id uuid,
  connected_at timestamptz not null default now(),
  unique (user_id, platform, handle)
);
create index social_accounts_user_idx on public.social_accounts (user_id);

create table public.verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  platform public.social_platform not null,
  content_text text not null default '' check (length(content_text) <= 30000),
  -- media_url est une clé de bucket privé, jamais une URL signée expirante.
  media_url text,
  media_type text not null default 'none'
    check (media_type in ('none', 'image', 'carousel', 'video')),
  ai_score integer check (ai_score between 0 and 100),
  ai_risk_level public.risk_level,
  ai_explanation jsonb not null default '{}'::jsonb
    check (jsonb_typeof(ai_explanation) = 'object'),
  ai_rewrite_suggestion text,
  accepted_caption text,
  hash_sha256 text check (hash_sha256 ~ '^[0-9a-f]{64}$'),
  prompt_version text,
  status public.verification_status not null default 'queued',
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint verification_finalized_complete check (
    status not in ('completed', 'accepted', 'kept')
    or (ai_score is not null and ai_risk_level is not null and hash_sha256 is not null)
  ),
  unique (id, user_id)
);
create index verifications_user_recent_idx
  on public.verifications (user_id, created_at desc, id desc);
create index verifications_user_status_idx
  on public.verifications (user_id, status, created_at desc);
create index verifications_user_platform_idx
  on public.verifications (user_id, platform, created_at desc);

create table public.ai_analyses (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null references public.verifications (id) on delete cascade,
  stage text not null default 'text'
    check (stage in ('text', 'vision', 'transcription', 'rewrite', 'assistant')),
  model_used text not null check (length(model_used) between 1 and 120),
  prompt_tokens integer not null default 0 check (prompt_tokens >= 0),
  completion_tokens integer not null default 0 check (completion_tokens >= 0),
  latency_ms integer not null default 0 check (latency_ms >= 0),
  cost_usd numeric(14,8) not null default 0 check (cost_usd >= 0),
  raw_response jsonb not null default '{}'::jsonb
    check (jsonb_typeof(raw_response) in ('object', 'array')),
  created_at timestamptz not null default now()
);
create index ai_analyses_verification_idx
  on public.ai_analyses (verification_id, created_at desc);
create index ai_analyses_cost_idx on public.ai_analyses (created_at desc);

create table public.compliance_rules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^R[0-9]+$'),
  description text not null,
  severity public.rule_severity not null,
  source_article text,
  source_url text,
  kind public.rule_kind not null,
  is_ai_assisted boolean not null default false,
  is_active boolean not null default true,
  rule_version text not null default 'v1.0',
  updated_at timestamptz not null default now()
);

create table public.brand_deals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  brand_name text not null check (length(trim(brand_name)) between 1 and 200),
  start_date date not null,
  end_date date,
  -- Stocker un chemin Supabase Storage, pas une URL publique.
  contract_url text,
  archived_at timestamptz,
  hash_sha256 text check (hash_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  constraint valid_deal_dates check (end_date is null or end_date >= start_date),
  constraint archived_deal_has_hash check (archived_at is null or hash_sha256 is not null)
);
create index brand_deals_user_idx on public.brand_deals (user_id, start_date desc);
create index brand_deals_archive_idx
  on public.brand_deals (user_id, archived_at desc) where archived_at is not null;

create table public.assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  verification_id uuid,
  messages jsonb not null default '[]'::jsonb
    check (jsonb_typeof(messages) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Empêche de lier la conversation à une vérification d'un autre utilisateur.
  constraint conversation_owned_verification_fk
    foreign key (verification_id, user_id)
    references public.verifications (id, user_id) on delete set null (verification_id)
);
create index assistant_conversations_user_idx
  on public.assistant_conversations (user_id, created_at desc);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  stripe_subscription_id text unique,
  plan public.account_plan not null default 'solo',
  status public.subscription_status not null default 'incomplete',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_status_idx on public.subscriptions (status, current_period_end);

create table public.law_documents (
  id uuid primary key default gen_random_uuid(),
  article_ref text not null unique,
  content text not null,
  source_url text not null,
  effective_on date,
  checked_at timestamptz not null default now(),
  embedding extensions.vector(1536),
  embedding_model text not null default 'text-embedding-3-small',
  updated_at timestamptz not null default now()
);
create index law_documents_embedding_hnsw_idx on public.law_documents
  using hnsw (embedding extensions.vector_cosine_ops);

-- Compteurs de quotas atomiques côté serveur (non modifiables par le client).
create table public.usage_monthly (
  user_id uuid not null references public.users (id) on delete cascade,
  period_start date not null,
  checks_used integer not null default 0 check (checks_used >= 0),
  rewrites_used integer not null default 0 check (rewrites_used >= 0),
  mia_messages_used integer not null default 0 check (mia_messages_used >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, period_start),
  check (extract(day from period_start) = 1)
);
create index usage_monthly_period_idx on public.usage_monthly (period_start);

-- Seuls les textes acceptés ET explicitement autorisés peuvent servir au dataset.
create table public.rewrite_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  verification_id uuid not null,
  original_caption text not null,
  accepted_caption text not null,
  prompt_version text not null,
  training_consent_snapshot boolean not null default false,
  accepted_at timestamptz not null default now(),
  unique (verification_id),
  foreign key (verification_id, user_id)
    references public.verifications (id, user_id) on delete cascade
);
create index rewrite_feedback_training_idx
  on public.rewrite_feedback (accepted_at)
  where training_consent_snapshot;

commit;
