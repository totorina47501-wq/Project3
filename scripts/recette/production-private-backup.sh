#!/usr/bin/env bash
# MentionCheck PRODUCTION: encrypted private local PostgreSQL logical backup.
# OPERATOR ONLY: never execute via CI, GitHub Actions, Supabase SQL or Cloudflare.
# Supabase Storage FILE CONTENTS are NOT included; see docs/64-production-private-backup.md.
set -Eeuo pipefail
umask 077
fail() { printf 'MC_PRODUCTION_BACKUP_BLOCKED: %s\n' "$1" >&2; exit 1; }
if [[ "$#" -ne 1 || "$1" != "--backup" ]]; then
  printf 'Usage: MC_BACKUP_DIR=... MC_BACKUP_WORKDIR=... MC_BACKUP_AGE_IDENTITY=... MENTIONCHECK_PROD_POSTGRES_URL=... bash %s --backup\n' "$0"
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
supabase db dump --db-url "$MENTIONCHECK_PROD_POSTGRES_URL" -f "$tmp/migration_history.sql" \
  --use-copy --data-only --schema supabase_migrations \
  > "$tmp/migrations.log" 2>&1 || fail 'Migration-history dump failed; no backup created'
for f in roles.sql schema.sql data.sql migration_history.sql; do
  [[ -s "$tmp/$f" ]] || fail 'One required SQL export is empty'
done
tar -C "$tmp" -cf "$tmp/archive.tar" \
  roles.sql schema.sql data.sql migration_history.sql ||
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
