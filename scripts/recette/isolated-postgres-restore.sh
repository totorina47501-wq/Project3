#!/usr/bin/env bash
# Recette PostgreSQL 17, uniquement avec données synthétiques, Docker LOCAL.
# Aucun nom de base, identifiant, URL ou dump de production n'est accepté.
set -Eeuo pipefail

fail() { printf 'REFUS RECETTE LOCALE : %s\n' "$1" >&2; exit 1; }

command -v docker >/dev/null 2>&1 || fail "Docker local absent."
[[ -z "$(printenv DOCKER_HOST || true)" ]] || fail "DOCKER_HOST est défini : risque de moteur distant."
[[ -z "$(printenv DOCKER_CONTEXT || true)" ]] || fail "DOCKER_CONTEXT est défini : contexte non contrôlé."

endpoint="$(docker context inspect default --format '{{ .Endpoints.docker.Host }}')" \
  || fail "Impossible d'inspecter le contexte Docker default."
case "$endpoint" in
  unix://*) ;;
  *) fail "Le contexte Docker default ne pointe pas vers un socket Unix local." ;;
esac
docker --context default info --format '{{ .ServerVersion }}' >/dev/null \
  || fail "Moteur Docker local indisponible."

container="mentioncheck-recette-local-$RANDOM-$$"
tmpdir="$(mktemp -d -t mentioncheck-recette.XXXXXX)"
started=0
cleanup() {
  if [[ "$started" == 1 ]]; then
    docker --context default rm -f "$container" >/dev/null 2>&1 || true
  fi
  rm -rf -- "$tmpdir"
}
trap cleanup EXIT

# Aucune publication de port, aucun volume persistant, réseau du conteneur coupé.
# L'image publique peut être téléchargée si elle n'est pas déjà présente.
docker --context default run --detach --rm \
  --name "$container" --network none \
  --tmpfs /var/lib/postgresql/data:rw,size=512m \
  -e POSTGRES_PASSWORD=fixture-jetable-uniquement \
  -e POSTGRES_DB=mentioncheck_fixture \
  postgres:17-alpine > "$tmpdir/container.id"
started=1

ready=0
for (( attempt=0; attempt<60; attempt++ )); do
  if docker --context default exec "$container" pg_isready \
      -q -U postgres -d mentioncheck_fixture; then
    ready=1
    break
  fi
  sleep 1
done
[[ "$ready" == 1 ]] || fail "PostgreSQL jetable indisponible."

docker --context default exec "$container" psql \
  -X -U postgres -d mentioncheck_fixture -v ON_ERROR_STOP=1 \
  -c "create table public.recette_fixture(id integer primary key, label text not null);
      insert into public.recette_fixture(id,label)
      values (1,'fixture-a'),(2,'fixture-b');" >/dev/null

# Le dump ne contient que deux lignes factices créées par cette commande.
docker --context default exec "$container" pg_dump \
  -U postgres --format=custom --no-owner --no-privileges \
  -d mentioncheck_fixture > "$tmpdir/fixture.dump"
test -s "$tmpdir/fixture.dump" || fail "Dump vide."

docker --context default exec "$container" createdb \
  -U postgres mentioncheck_restored
docker --context default exec -i "$container" pg_restore \
  -U postgres --exit-on-error --no-owner --no-privileges \
  -d mentioncheck_restored < "$tmpdir/fixture.dump"

query="select count(*)::text||':'||md5(string_agg(id::text||':'||label,'|' order by id))
       from public.recette_fixture"
source="$(docker --context default exec "$container" psql \
  -X -U postgres -At -d mentioncheck_fixture -c "$query")"
restored="$(docker --context default exec "$container" psql \
  -X -U postgres -At -d mentioncheck_restored -c "$query")"
[[ "$source" == "$restored" && "$restored" == 2:* ]] \
  || fail "Comparaison des empreintes et lignes restaurées échouée."

printf 'OK : pg_dump/pg_restore PostgreSQL 17 et checksum de 2 fixtures identiques.\n'
printf 'Périmètre : démonstration locale SYNTHÉTIQUE, PAS restauration de sauvegarde production.\n'
