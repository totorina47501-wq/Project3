#!/usr/bin/env bash
# Restauration réelle du schéma PUBLIC du Supabase staging vers Supabase LOCAL jetable.
# Aucune donnée source ni commande d'écriture distante. Dump et logs détruits en sortie.
set -Eeuo pipefail
fail() { printf 'STAGING_SCHEMA_RESTORE_FAILED step=%s\n' "$1" >&2; exit 1; }
command -v docker >/dev/null 2>&1 || fail docker_missing
command -v npm >/dev/null 2>&1 || fail npm_missing
test -n "$MENTIONCHECK_STAGING_POSTGRES_URL" || fail no_secret
test -z "$(printenv DOCKER_HOST || true)" || fail docker_remote_forbidden
test -z "$(printenv DOCKER_CONTEXT || true)" || fail docker_context_forbidden
case "$(docker context inspect default --format '{{ .Endpoints.docker.Host }}')" in
 unix://*) ;;
 *) fail docker_endpoint_not_unix ;;
esac
repo_root="$PWD"
temporary="$(mktemp -d -t mentioncheck-staging-schema.XXXXXX)"
lab="$temporary/local-supabase"
cli="$temporary/cli/node_modules/.bin/supabase"
started=0
cleanup() {
 set +e
 if [ "$started" = 1 ] && [ -x "$cli" ]; then
   (cd "$lab" && "$cli" stop --no-backup) >/dev/null 2>&1
 fi
 rm -rf -- "$temporary"
}
trap cleanup EXIT
mkdir -p "$lab" "$temporary/cli"

# Catalog fingerprints contain metadata ONLY and do not SELECT user rows.
cat > "$temporary/catalog.sql" <<'SQL'
WITH items(kind,definition) AS (
 SELECT 'tables',c.relname||':'||c.relrowsecurity::text||':'||c.relforcerowsecurity::text
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN ('r','p')
 UNION ALL
 SELECT 'columns',c.relname||':'||a.attname||':'||format_type(a.atttypid,a.atttypmod)||':'||a.attnotnull::text||':'||coalesce(pg_get_expr(d.adbin,d.adrelid),'')
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 JOIN pg_attribute a ON a.attrelid=c.oid
 LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
 WHERE n.nspname='public' AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped
 UNION ALL
 SELECT 'policies',tablename||':'||policyname||':'||cmd||':'||roles::text||':'||coalesce(qual,'')||':'||coalesce(with_check,'')
 FROM pg_policies WHERE schemaname='public'
 UNION ALL
 SELECT 'functions',p.proname||':'||pg_get_function_identity_arguments(p.oid)||':'||md5(pg_get_functiondef(p.oid))
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
 UNION ALL
 SELECT 'constraints',c.relname||':'||con.conname||':'||pg_get_constraintdef(con.oid)
 FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
 UNION ALL
 SELECT 'indexes',c.relname||':'||pg_get_indexdef(c.oid)
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind='i'
 UNION ALL
 SELECT 'triggers',c.relname||':'||t.tgname||':'||pg_get_triggerdef(t.oid)
 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND NOT t.tgisinternal
 UNION ALL
 SELECT 'enums',typ.typname||':'||e.enumlabel
 FROM pg_type typ JOIN pg_namespace n ON n.oid=typ.typnamespace
 JOIN pg_enum e ON e.enumtypid=typ.oid WHERE n.nspname='public'
)
SELECT kind||'|'||count(*)||'|'||md5(string_agg(definition,E'\n' ORDER BY definition))
FROM items GROUP BY kind ORDER BY kind;
SQL

# Container libpq is forced read-only on the source database, including fingerprint SELECTs.
docker run --rm --env MENTIONCHECK_STAGING_POSTGRES_URL \
 --env PGOPTIONS='-c default_transaction_read_only=on' \
 -v "$temporary/catalog.sql:/catalog.sql:ro" postgres:17-alpine \
 sh -ec 'psql "$MENTIONCHECK_STAGING_POSTGRES_URL" -X -A -t -w -v ON_ERROR_STOP=1 -f /catalog.sql' \
 > "$temporary/source.fingerprint" 2> "$temporary/source.log" \
 || fail source_connect_or_catalog
grep -q '^tables|27|' "$temporary/source.fingerprint" || fail unexpected_source_table_count
grep -q '^policies|25|' "$temporary/source.fingerprint" || fail unexpected_source_policy_count
grep -q '^functions|30|' "$temporary/source.fingerprint" || fail unexpected_source_function_count
printf 'STAGING_REMOTE_CATALOG_READONLY_PASS tables=27 policies=25 functions=30\n'

# The standalone CLI runs in a disposable folder, never linked to production.
npm install --prefix "$temporary/cli" --no-audit --no-fund --silent supabase@2 \
 > "$temporary/npm.log" 2>&1 || fail supabase_cli_install
(cd "$lab" && "$cli" init --yes) > "$temporary/init.log" 2>&1 || fail supabase_init
# Supabase db dump avoids managed schemas/roles and exports schema only.
(cd "$lab" && "$cli" db dump --db-url "$MENTIONCHECK_STAGING_POSTGRES_URL" \
 --schema public -f "$temporary/real-staging-public.sql") \
 > "$temporary/dump.log" 2>&1 || fail supabase_schema_dump
test -s "$temporary/real-staging-public.sql" || fail empty_schema_dump
# Supabase CLI `db dump` exports SCHEMA ONLY by default. Pg functions can contain
# INSERT/COPY statements as SOURCE CODE: do not mistake them for exported user rows.
# An actual pg_dump DATA section has a specific top-level metadata header.
if grep -Eiq '^-- Data for Name: .*; Type: TABLE DATA;' \
 "$temporary/real-staging-public.sql"; then fail schema_dump_contains_data; fi
# Fail closed if no schema/table definition is present.
if ! grep -Eq '^CREATE TABLE public\\.|^CREATE TABLE "public"\\.' \
 "$temporary/real-staging-public.sql"; then fail schema_dump_missing_tables; fi
printf 'STAGING_REMOTE_SCHEMA_DUMP_PASS schema=public data=excluded\n'

# Start a fresh LOCAL Supabase project with Auth/Storage system catalogs.
# Do not use linked project and NEVER use db reset / db push / apply against remote.
(cd "$lab" && env -u MENTIONCHECK_STAGING_POSTGRES_URL "$cli" start) \
 > "$temporary/local-start.log" 2>&1 || fail local_supabase_start
started=1
local_dsn='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
# All following SQL commands target localhost inside the runner only.
docker run --rm --network host postgres:17-alpine \
 psql "$local_dsn" -X -A -t -w -v ON_ERROR_STOP=1 \
 -c 'CREATE SCHEMA IF NOT EXISTS extensions; CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions; CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions; CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;' \
 > "$temporary/extension.log" 2>&1 || fail local_extensions
docker run --rm --network host \
 -v "$temporary/real-staging-public.sql:/app-schema.sql:ro" postgres:17-alpine \
 psql "$local_dsn" -X -w -v ON_ERROR_STOP=1 --single-transaction -f /app-schema.sql \
 > "$temporary/restore.log" 2>&1 || fail local_schema_restore
docker run --rm --network host \
 -v "$temporary/catalog.sql:/catalog.sql:ro" postgres:17-alpine \
 psql "$local_dsn" -X -A -t -w -v ON_ERROR_STOP=1 -f /catalog.sql \
 > "$temporary/restored.fingerprint" 2> "$temporary/restored.log" \
 || fail restored_catalog
if ! cmp -s "$temporary/source.fingerprint" "$temporary/restored.fingerprint"; then
  printf 'STAGING_SCHEMA_CATALOG_MISMATCH categories:\n' >&2
  # Only categories and counts are shown, no user data or SQL definitions.
  cut -d'|' -f1,2 "$temporary/source.fingerprint" >&2
  cut -d'|' -f1,2 "$temporary/restored.fingerprint" >&2
  fail restored_fingerprint_differs
fi
printf 'STAGING_REAL_PUBLIC_SCHEMA_RESTORE_PASS source=ukvgnkxgzyhswgpnvyzz dest=local_disposable\n'
printf 'STAGING_SCHEMA_CATALOG_FINGERPRINT_PASS tables=27 policies=25 functions=30\n'
printf 'STAGING_REAL_SCHEMA_NO_DATA_NO_PRODUCTION_WRITES_PASS\n'
