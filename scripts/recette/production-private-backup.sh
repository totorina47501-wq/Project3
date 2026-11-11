#!/usr/bin/env bash
# MentionCheck PRODUCTION: encrypted private local PostgreSQL logical backup.
# OPERATOR ONLY: never execute via CI, GitHub Actions, Supabase SQL or Cloudflare.
# Supabase Storage FILE CONTENTS are NOT included; see docs/64-production-private-backup.md.
set -Eeuo pipefail
umask 077
fail() { printf 'MC_PRODUCTION_BACKUP_BLOCKED: %s\n' "$1" >&2; exit 1; }

# Verification is private: NEVER run it on hosted CI or with a remote DB URL.
if [[ "$#" -eq 1 && "$1" == "--verify-restore" ]]; then
  [[ -z "$(printenv CI || true)" && -z "$(printenv GITHUB_ACTIONS || true)" ]] ||
    fail 'Refused CI / GitHub Actions; run on a trusted encrypted host'
  [[ -z "$(printenv MENTIONCHECK_PROD_POSTGRES_URL || true)" &&
     -z "$(printenv MENTIONCHECK_STAGING_POSTGRES_URL || true)" ]] ||
    fail 'Restore mode refuses remote database URLs'
  [[ -z "$(printenv DOCKER_HOST || true)" && -z "$(printenv DOCKER_CONTEXT || true)" ]] ||
    fail 'Remote Docker endpoints are forbidden'
  for cmd in docker node git tar age sha256sum openssl mktemp realpath; do
    command -v "$cmd" >/dev/null || fail "Missing local tool: $cmd"
  done
  [[ "$(docker context show 2>/dev/null)" == default ]] ||
    fail 'Only default local Docker context is allowed'
  case "$(docker context inspect default --format '{{ .Endpoints.docker.Host }}' 2>/dev/null)" in
    unix://*) ;; *) fail 'Local Unix Docker socket required' ;;
  esac
  [[ -n "$(printenv MC_ENCRYPTED_ARCHIVE || true)" &&
     -n "$(printenv MC_BACKUP_WORKDIR || true)" &&
     -n "$(printenv MC_BACKUP_AGE_IDENTITY || true)" ]] ||
    fail 'Private encrypted archive, workdir and age identity required'
  [[ "$MC_ENCRYPTED_ARCHIVE" == /* && "$MC_BACKUP_WORKDIR" == /* &&
     "$MC_BACKUP_AGE_IDENTITY" == /* ]] || fail 'Absolute paths required'
  archive="$(realpath -e -- "$MC_ENCRYPTED_ARCHIVE")" || fail 'Archive unavailable'
  work="$(realpath -e -- "$MC_BACKUP_WORKDIR")" || fail 'Workdir unavailable'
  key="$(realpath -e -- "$MC_BACKUP_AGE_IDENTITY")" || fail 'Age identity unavailable'
  [[ -f "$archive" && "$archive" == *.tar.age &&
     -f "$archive.sha256" && -d "$work" && -f "$key" ]] ||
    fail 'Private restore files missing'
  repo_root="$(cd "$(dirname "$0")/../.." && pwd -P)"
  for path in "$archive" "$work" "$key"; do
    [[ "$path" != "$repo_root" && "$path" != "$repo_root/"* ]] ||
      fail 'Restore files and private key cannot be in Git repository'
  done
  if git -C "$work" rev-parse --show-toplevel >/dev/null 2>&1 ||
     git -C "$(dirname "$archive")" rev-parse --show-toplevel >/dev/null 2>&1; then
    fail 'Private archive/workdir must not belong to a Git working tree'
  fi
  export MC_BACKUP_WORKDIR="$work" MC_BACKUP_AGE_IDENTITY="$key"
  node --input-type=module -e '
    import fs from "node:fs";
    for(const n of ["MC_BACKUP_WORKDIR","MC_BACKUP_AGE_IDENTITY"]) {
      if((fs.statSync(process.env[n]).mode & 0o077)!==0)process.exit(2);
    }
    for(const n of ["MC_EXPECT_AUTH_USERS","MC_EXPECT_APP_USERS","MC_EXPECT_QUOTA_ROWS","MC_EXPECT_STORAGE_METADATA"]) {
      if(!/^[0-9]+$/.test(process.env[n]||""))process.exit(3);
    }
  ' || fail 'Private file permissions (700/600) or expected aggregate counts invalid'
  expected_sha="$(head -n 1 "$archive.sha256" | cut -d' ' -f1)"
  [[ "$expected_sha" =~ ^[0-9a-f]{64}$ ]] || fail 'Invalid SHA256 sidecar'
  [[ "$(sha256sum "$archive" | cut -d' ' -f1)" == "$expected_sha" ]] ||
    fail 'Encrypted archive checksum mismatch'
  image='supabase/postgres:17.6.1.084'
  docker image inspect "$image" >/dev/null 2>&1 ||
    fail 'Pull approved pinned PG17 Docker image locally before this offline test'
  tmp="$(mktemp -d "$work/mentioncheck-restore-XXXXXXXX")" ||
    fail 'Cannot allocate private restore directory'
  container="mc-restore-$(openssl rand -hex 10)"
  cleanup_restore() {
    docker rm -f "$container" >/dev/null 2>&1 || true
    rm -rf -- "$tmp"
  }
  trap cleanup_restore EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  age -d -i "$key" "$archive" > "$tmp/archive.tar" 2> "$tmp/decrypt.log" ||
    fail 'Cannot decrypt private backup'
  tar -tf "$tmp/archive.tar" > "$tmp/members" 2> "$tmp/tar.log" ||
    fail 'Cannot inspect decrypted tar'
  printf '%s\n' roles.sql schema.sql data.sql migration_schema.sql migration_history.sql |
    LC_ALL=C sort > "$tmp/expected-members"
  LC_ALL=C sort "$tmp/members" > "$tmp/sorted-members"
  cmp -s "$tmp/expected-members" "$tmp/sorted-members" ||
    fail 'Unexpected tar member (no extraction permitted)'
  for part in roles.sql schema.sql data.sql migration_schema.sql migration_history.sql; do
    tar -xOf "$tmp/archive.tar" "$part" > "$tmp/$part" 2> "$tmp/tar.log" ||
      fail 'Failed reading SQL member'
    [[ -s "$tmp/$part" ]] || fail 'Empty SQL member'
  done
  # No external networking, host ports, bind mounts or persistent PGDATA.
  password="$(openssl rand -hex 24)"
  docker run -d --rm --pull=never --name "$container" --network none \
    --security-opt no-new-privileges:true --shm-size=128m \
    --tmpfs /var/lib/postgresql/data:rw,nosuid,nodev,size=1073741824 \
    --tmpfs /tmp:rw,nosuid,nodev,size=268435456 \
    -e POSTGRES_PASSWORD="$password" -e POSTGRES_DB=postgres "$image" \
    > "$tmp/docker.log" 2>&1 || fail 'Cannot boot isolated PG17'
  unset password
  ready=false
  for i in {1..60}; do
    if docker exec -u postgres "$container" pg_isready -U postgres -d postgres \
      >/dev/null 2>&1; then ready=true; break; fi
    sleep 1
  done
  [[ "$ready" == true ]] || fail 'Isolated database is not ready'
  cat "$tmp/roles.sql" "$tmp/schema.sql" > "$tmp/restore.sql"
  printf '\nSET session_replication_role = replica;\n' >> "$tmp/restore.sql"
  cat "$tmp/data.sql" >> "$tmp/restore.sql"
  docker exec -i -u postgres "$container" psql -X -U postgres -d postgres \
    --single-transaction --set ON_ERROR_STOP=1 --file - < "$tmp/restore.sql" \
    > "$tmp/psql.log" 2>&1 || fail 'SQL restore failed; private logs only'
  cat "$tmp/migration_schema.sql" "$tmp/migration_history.sql" > "$tmp/migrations.sql"
  docker exec -i -u postgres "$container" psql -X -U postgres -d postgres \
    --single-transaction --set ON_ERROR_STOP=1 --file - < "$tmp/migrations.sql" \
    > "$tmp/migrations.log" 2>&1 || fail 'Migration history restore failed'
  query="select json_build_object(
    'auth_users',(select count(*) from auth.users),
    'app_users',(select count(*) from public.users),
    'quota_rows',(select count(*) from public.usage_monthly),
    'storage_metadata',(select count(*) from storage.objects),
    'public_tables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'),
    'rls_tables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity),
    'rls_policies',(select count(*) from pg_policies where schemaname='public'),
    'functions',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'),
    'constraints',(select count(*) from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'),
    'extensions',(select count(*) from pg_extension),
    'migration_rows',(select count(*) from supabase_migrations.schema_migrations)
  )::text"
  stats="$(docker exec -u postgres "$container" psql -XAt -U postgres -d postgres \
    --set ON_ERROR_STOP=1 --command "$query" 2> "$tmp/verify.log")" ||
    fail 'Catalog verification failed'
  RESTORE_STATS_JSON="$stats" node --input-type=module -e '
    const s=JSON.parse(process.env.RESTORE_STATS_JSON);
    const map={auth_users:"MC_EXPECT_AUTH_USERS",app_users:"MC_EXPECT_APP_USERS",
      quota_rows:"MC_EXPECT_QUOTA_ROWS",storage_metadata:"MC_EXPECT_STORAGE_METADATA"};
    for(const [col,env] of Object.entries(map))
      if(s[col]!==Number(process.env[env]))process.exit(3);
    if(!(s.public_tables>0&&s.rls_tables>0&&s.rls_policies>0&&
      s.functions>0&&s.constraints>0&&s.extensions>0&&s.migration_rows>0))
      process.exit(4);
  ' || fail 'Expected source counts or schema catalog check failed'
  printf 'MC_LOGICAL_DOCKER_RESTORE_VERIFIED (SQL, roles, migrations and aggregates)\n'
  printf 'STORAGE_OBJECT_BYTES_NOT_RESTORED; FULL_PRA_CERTIFICATION_PENDING\n'
  exit 0
fi

if [[ "$#" -ne 1 || "$1" != "--backup" ]]; then
  printf 'Usage: MC_BACKUP_DIR=... MC_BACKUP_WORKDIR=... MC_BACKUP_AGE_IDENTITY=... MENTIONCHECK_PROD_POSTGRES_URL=... bash %s --backup (or --verify-restore; see docs/64)\n' "$0"
  exit 2
fi

# Never transmit personal data to ephemeral/cloud CI runners.
[[ -z "$(printenv CI || true)" && -z "$(printenv GITHUB_ACTIONS || true)" ]] ||
  fail 'Refused CI / GitHub Actions; use a trusted operator computer'
[[ -z "$(printenv DOCKER_HOST || true)" && -z "$(printenv DOCKER_CONTEXT || true)" ]] ||
  fail 'Remote Docker contexts are forbidden'
command -v node >/dev/null || fail 'Node.js is required'
command -v git >/dev/null || fail 'git is required'

export MENTIONCHECK_PROD_POSTGRES_URL="$(printenv MENTIONCHECK_PROD_POSTGRES_URL || true)"
[[ -n "$MENTIONCHECK_PROD_POSTGRES_URL" ]] || fail 'Production DB URL missing (do not paste it in chat)'
# Only the EXACT production host or session pooler with exact production username,
# port 5432, database postgres, and TLS is permitted. No credential is ever logged.
node --input-type=module -e '
try {
 const u = new URL(process.env.MENTIONCHECK_PROD_POSTGRES_URL);
 const ref = "zcztvberuihphqklhjsr";
 const direct = u.hostname === "db." + ref + ".supabase.co" && u.username === "postgres";
 const pooled = u.hostname.endsWith(".pooler.supabase.com") && u.username === "postgres." + ref;
 if (!["postgres:", "postgresql:"].includes(u.protocol) ||
     (!direct && !pooled) ||
     u.port !== "5432" || u.pathname !== "/postgres" ||
     !u.password || u.searchParams.get("sslmode") !== "require") process.exit(2);
} catch { process.exit(2); }
' || fail 'DB target does not match exact Production ref, TLS, or session port'

export MC_BACKUP_DIR="$(printenv MC_BACKUP_DIR || true)"
export MC_BACKUP_WORKDIR="$(printenv MC_BACKUP_WORKDIR || true)"
export MC_BACKUP_AGE_IDENTITY="$(printenv MC_BACKUP_AGE_IDENTITY || true)"
[[ -n "$MC_BACKUP_DIR" && -n "$MC_BACKUP_WORKDIR" && -n "$MC_BACKUP_AGE_IDENTITY" ]] ||
  fail 'Encrypted workdir, private destination and local age identity required'
[[ "$MC_BACKUP_DIR" = /* && "$MC_BACKUP_WORKDIR" = /* && "$MC_BACKUP_AGE_IDENTITY" = /* ]] ||
  fail 'All paths must be absolute'
dest="$(realpath -e -- "$MC_BACKUP_DIR")" || fail 'Destination directory unavailable'
work="$(realpath -e -- "$MC_BACKUP_WORKDIR")" || fail 'Work directory unavailable'
key="$(realpath -e -- "$MC_BACKUP_AGE_IDENTITY")" || fail 'Age private key unavailable'
repo_root="$(cd "$(dirname "$0")/../.." && pwd -P)"
for path in "$dest" "$work" "$key"; do
  [[ "$path" != "$repo_root" && "$path" != "$repo_root/"* ]] ||
    fail 'Secrets or backups must never be inside the Git repository'
done
for path in "$dest" "$work"; do
  if git -C "$path" rev-parse --show-toplevel >/dev/null 2>&1; then
    fail 'Destination/work directory belongs to a Git working tree'
  fi
done
export MC_BACKUP_DIR="$dest" MC_BACKUP_WORKDIR="$work" MC_BACKUP_AGE_IDENTITY="$key"
node --input-type=module -e '
import fs from "node:fs";
for (const name of ["MC_BACKUP_DIR", "MC_BACKUP_WORKDIR"]) {
 const s=fs.statSync(process.env[name]);
 if(!s.isDirectory()||(s.mode & 0o077)!==0)process.exit(2);
}
const key=fs.statSync(process.env.MC_BACKUP_AGE_IDENTITY);
if(!key.isFile()||(key.mode & 0o077)!==0)process.exit(2);
' || fail 'Backup folders must be chmod 700, private key chmod 600'
for cmd in supabase docker tar age age-keygen sha256sum mktemp; do
  command -v "$cmd" >/dev/null || fail "Missing local tool: $cmd"
done
case "$(docker context inspect default --format '{{ .Endpoints.docker.Host }}' 2>/dev/null)" in
  unix://*) ;; *) fail 'Docker default must use a local Unix socket' ;;
esac
supabase db dump --help >/dev/null 2>&1 || fail 'Supabase CLI db dump unavailable'
recipient="$(age-keygen -y "$key" 2>/dev/null)" || fail 'Cannot derive age recipient'
case "$recipient" in age1*) ;; *) fail 'Invalid age recipient' ;; esac

tmp="$(mktemp -d "$work/mentioncheck-private-XXXXXXXX")" ||
  fail 'Cannot create isolated private temporary folder'
cleanup() { rm -rf -- "$tmp"; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# Fail closed: never log a DB URL or unencrypted SQL to stdout/stderr.
supabase db dump --db-url "$MENTIONCHECK_PROD_POSTGRES_URL" -f "$tmp/roles.sql" --role-only \
  > "$tmp/roles.log" 2>&1 || fail 'Role dump failed; no backup created'
supabase db dump --db-url "$MENTIONCHECK_PROD_POSTGRES_URL" -f "$tmp/schema.sql" \
  > "$tmp/schema.log" 2>&1 || fail 'Schema dump failed; no backup created'
supabase db dump --db-url "$MENTIONCHECK_PROD_POSTGRES_URL" -f "$tmp/data.sql" --use-copy --data-only \
  -x storage.buckets_vectors -x storage.vector_indexes \
  > "$tmp/data.log" 2>&1 || fail 'Data dump failed; no backup created'
supabase db dump --db-url "$MENTIONCHECK_PROD_POSTGRES_URL" -f "$tmp/migration_schema.sql" \
  --schema supabase_migrations \
  > "$tmp/migration_schema.log" 2>&1 || fail 'Migration schema dump failed; no backup created'
supabase db dump --db-url "$MENTIONCHECK_PROD_POSTGRES_URL" -f "$tmp/migration_history.sql" \
  --use-copy --data-only --schema supabase_migrations \
  > "$tmp/migrations.log" 2>&1 || fail 'Migration-history dump failed; no backup created'
for f in roles.sql schema.sql data.sql migration_schema.sql migration_history.sql; do
  [[ -s "$tmp/$f" ]] || fail 'One required SQL export is empty'
done
tar -C "$tmp" -cf "$tmp/archive.tar" \
  roles.sql schema.sql data.sql migration_schema.sql migration_history.sql ||
  fail 'Cannot package all SQL dumps'
age -r "$recipient" -o "$tmp/archive.age" "$tmp/archive.tar" ||
  fail 'Age encryption failed'
original="$(sha256sum "$tmp/archive.tar" | cut -d' ' -f1)"
decoded="$(age -d -i "$key" "$tmp/archive.age" 2>/dev/null | sha256sum | cut -d' ' -f1)" ||
  fail 'Cannot verify encrypted data by decrypting to memory pipe'
[[ -n "$original" && "$original" == "$decoded" ]] ||
  fail 'Encrypted backup integrity mismatch'
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
out="$dest/mentioncheck-prod-$stamp-$$.tar.age"
[[ ! -e "$out" ]] || fail 'Refusing to overwrite existing backup'
mv -- "$tmp/archive.age" "$out" || fail 'Cannot move encrypted backup'
chmod 600 "$out"
sha256sum "$out" > "$out.sha256"
chmod 600 "$out.sha256"
# No user, file-content, credentials, or SQL ever printed.
printf 'MC_PRODUCTION_ENCRYPTED_BACKUP_CREATED (private directory, sha256 checked)\n'
printf 'ENCRYPTED_FILE=%s\n' "$out"
printf 'RESTORATION_NOT_YET_VERIFIED; storage object bytes need a separate backup\n'
