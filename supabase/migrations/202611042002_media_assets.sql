-- MentionCheck: espace media prive, sans analyse IA ni appel externe payant.
begin;
create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  group_id uuid,
  kind text not null check (kind in ('image','video')),
  status text not null default 'pending' check (status in ('pending','ready')),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','video/mp4','video/quicktime')),
  declared_bytes integer not null check (declared_bytes between 1 and 52428800),
  actual_bytes integer check (actual_bytes between 1 and 52428800),
  duration_seconds integer check (duration_seconds between 1 and 60),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '1 hour'),
  constraint media_asset_status_consistency check (
    (status = 'pending' and completed_at is null and actual_bytes is null)
    or (status = 'ready' and completed_at is not null and actual_bytes is not null)
  )
);
create index if not exists media_assets_owner_created_idx
  on public.media_assets (user_id, created_at desc);
create index if not exists media_assets_expiration_idx
  on public.media_assets (expires_at);
create index if not exists media_assets_group_idx
  on public.media_assets (user_id, group_id) where group_id is not null;
alter table public.media_assets enable row level security;
revoke all on public.media_assets from public, anon, authenticated;
grant select (id,user_id,group_id,kind,status,storage_path,mime_type,declared_bytes,
  actual_bytes,duration_seconds,created_at,completed_at,expires_at)
  on public.media_assets to authenticated;
create policy media_assets_select_own on public.media_assets
  for select to authenticated using ((select auth.uid()) = user_id);
comment on table public.media_assets is
  'Media de preparation: objets prives non analyses; expiration logique, purge physique a organiser.';
commit;
