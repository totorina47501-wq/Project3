-- Additive migration: do not overwrite historical evidence or enable jobs.
begin;
alter table public.media_assets
  add column if not exists media_sha256 text;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.media_assets'::regclass
      and conname = 'media_assets_media_sha256_format'
  ) then
    alter table public.media_assets
      add constraint media_assets_media_sha256_format
      check (media_sha256 is null or media_sha256 ~ '^[a-f0-9]{64}$');
  end if;
end $$;
comment on column public.media_assets.media_sha256 is
  'Technical SHA-256 of private stored bytes, server computed at upload confirmation. Null for legacy uploads.';
-- Deliberately no GRANT: only the service role reads/writes the digest.
commit;
