# Recette isolée à coût minimal — MentionCheck / issue #16

Date : 7 novembre 2026. **Statut : staging Supabase gratuit créé, migrations appliquées et test SQL A/B simulé réussi ; recette intégrale NON réalisée.**

Objectif : fournir des preuves de recette sans envoyer de données de production vers un environnement de test, sans utiliser de crédits IA, ni créer de ressources facturées sans approbation. Ce protocole **n'autorise aucune modification de Supabase production**.

## Point de départ vérifié

- Projet Supabase de production existant : `zcztvberuihphqklhjsr`, PostgreSQL 17, statut ACTIVE_HEALTHY lors du contrôle du 7 novembre.
- 27 tables publiques avec RLS activée, 18 migrations distantes recensées ; cinq tables sans politique RLS et cinq fonctions `SECURITY DEFINER` exposées aux utilisateurs authentifiés méritent une validation métier et A/B, pas une modification aveugle.
- Auth : l'alerte `leaked password protection disabled` est encore présente. L'activer est un choix administrateur, non une migration SQL.
- **Staging créé et vérifié le 7 novembre** : projet Supabase indépendant `ukvgnkxgzyhswgpnvyzz` (`MentionCheck-Staging`, `eu-central-1`, plan Free, devis Supabase **0 USD/mois**). La production demeure `zcztvberuihphqklhjsr`. Aucune sauvegarde/restauration de schéma réel n'est prouvée.
- Déjà couvert **localement** : `npm run test:sql:offline` (PGlite avec Auth/Storage simulés et pgvector volontairement omis), `npm run test:privacy:offline`, Playwright hors ligne. Ne pas recréer ces tests.

## Niveau A — coût de service : 0 € (poste/runner local)

### A1. Contrôles applicatifs déjà implémentés

Depuis le dépôt, Node conforme à `.nvmrc`, sans variable d'environnement pointant vers la production :

```bash
npm ci --ignore-scripts
npm run work:check
npm run test:sql:offline
npm run test:privacy:offline
npm run test:e2e
```

`npm run test:e2e` **sans** `PLAYWRIGHT_BASE_URL` utilise la fixture locale prévue dans `playwright.config.ts`. Les refus 401/403, l'origine CSRF, l'isolation SQL A/B et la navigation sont testés hors ligne. Ce n'est **pas** un test d'Auth hébergé réel. Si des variables `PLAYWRIGHT_BASE_URL` ou `E2E_MEDIA_UPLOAD_ENABLED` subsistent dans le shell, les retirer auparavant pour ce niveau ; ne pas réutiliser de vrais identifiants.

### A2. Restaurer une sauvegarde SYNTHÉTIQUE sur PostgreSQL local

Pré-requis : Bash et Docker local avec moteur `default` sur socket Unix. Script autonome, sans fichier `.env`, sans argument ni URL de connexion :

```bash
bash scripts/recette/isolated-postgres-restore.sh
```

Le script :
1. refuse `DOCKER_HOST` et `DOCKER_CONTEXT`, exige un moteur Docker local sur socket Unix ;
2. crée un PostgreSQL 17 jetable **sans réseau, sans port publié et sans volume** ;
3. crée exactement deux lignes factices, lance `pg_dump` puis `pg_restore` dans une seconde base, et compare le nombre de lignes et leur empreinte ;
4. détruit le conteneur et le dump temporaire, succès ou échec.

L'image `postgres:17-alpine` peut nécessiter un téléchargement gratuit. Le moteur réel et les droits Docker doivent être disponibles sur la machine d'exécution. **Ce test prouve une procédure mécanique de dump/restore PostgreSQL sur une fixture.** Il ne prouve ni la restauration d'une sauvegarde Supabase réelle ni le rollback des migrations MentionCheck.

### A3. Supabase local (Auth + Storage plus proches du réel)

La racine `supabase/` contient déjà les migrations et `seed.sql`, sans `config.toml` enregistré dans le dépôt. Sur un poste local propre, après avoir examiné l'aide et les versions de la CLI Supabase :

```bash
supabase --help
supabase init
supabase start
supabase db reset --local
supabase status
```

**Ne jamais utiliser** `supabase db reset --linked`, `--db-url` ou une cible distante ; ces variantes peuvent supprimer les données du projet lié. Ne pas lancer `supabase db push` sur la production. `supabase init` peut demander un choix si une configuration existe déjà : ne pas écraser sans revue. Les migrations historiques peuvent nécessiter des adaptations pour la CLI locale : enregistrer chaque échec, ne jamais le compenser en appliquant du SQL sur la production.

La pile locale utilise Docker et un stockage local : coût de fournisseur nul, consommation des ressources de la machine non nulle. Conserver `OPENAI_PAUSED=true`, `BILLING_ENABLED=false`, `MEDIA_RETENTION_ENABLED=false` et les fonctions payantes désactivées.

## Niveau B — staging Supabase hébergé gratuit créé (sans branche facturée)

Le **deuxième projet Free** existe désormais : [MentionCheck-Staging](https://supabase.com/dashboard/project/ukvgnkxgzyhswgpnvyzz). Il utilise une instance PostgreSQL, Auth et Storage séparés. **Les 18 migrations sources du dépôt ont été appliquées dans ce projet, sans recopier les données de production.** Ne pas créer de nouvelle branche payante, ni réutiliser les identifiants de production. Les tests Auth réels nécessitent encore deux comptes jetables A et B et un Worker staging relié **exclusivement** à ce projet. **Ne pas fusionner de branche DB vers la production** pour clore la recette.

**Coût vérifié de la création du projet staging : 0 USD/mois**, dans la limite des quotas du plan Free. Le coût d'une branche Preview, qui peut être facturée, est **hors périmètre** et aucune branche payante n'a été créée. Garder le projet Staging séparé, sans données réelles ni fournisseur payant.

### Vérifications hébergées obligatoires

1. **Isolation** : références Supabase/URL/clé publique staging différentes de production, `service_role` uniquement côté serveur ; ne jamais copier sa valeur dans un rapport, un frontend ou un journal.
2. **Auth A/B** : authentification, déconnexion, reset de mot de passe, sessions expirées, accès hors compte interdit.
3. **RLS et RPC** : tenter la lecture des fichiers, archives, conversations, studios et cinq fonctions `SECURITY DEFINER` depuis A sur les ressources de B, et inversement. Refus observés sur les vraies API ; vérifier aussi que les cinq tables sans policy ne deviennent pas exposées aux clients par un autre chemin.
4. **Médias** : uploads synthétiques privés, vérification d'URL signée et propriété, nettoyage **uniquement** des objets jetables créés pendant la session.
5. **CSRF / quotas** : origine tierce refusée, réponse 401/403, limites et réservations concurrentes, sans consommation d'API IA.
6. **RGPD** : export et dry-run de demande d'effacement, jamais suppression d'utilisateur ou de média non créé pour le test.
7. **Backup/rollback** : sauvegarde du staging, restauration sur une **autre base isolée**, comparaison tables/contraintes/policies, simulation de rollback de code avec SHA. Une sauvegarde ou un rollback **production** ne doit pas être déclenché.

### Exécuter seulement les tests E2E adaptés au staging

Le dépôt reconnaît `PLAYWRIGHT_BASE_URL` et `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` dans ses specs. Avant toute exécution distante, vérifier visuellement les URLs, les variables et les protections d'appel IA. Exemple de test **non destructif** à lancer uniquement sur staging :

```bash
# Variables privées propres AU STAGING ; ne pas les coller dans un terminal partagé
# PLAYWRIGHT_BASE_URL=https://<url-staging> E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=...
OPENAI_PAUSED=true BILLING_ENABLED=false \
  npx playwright test tests/e2e/authenticated-navigation.spec.ts
```

Attention : `PLAYWRIGHT_BASE_URL` évite le serveur de fixture locale et change réellement la destination. Pour l'upload, `E2E_MEDIA_UPLOAD_ENABLED=true` n'est permis que sur staging vérifié et après revue du nettoyage. Le contrôle SQL A/B du harnais local ne remplace pas les tests hébergés.

## Relevé de vérification Supabase Staging — 7 novembre 2026

- Projet staging `ukvgnkxgzyhswgpnvyzz`, distinct de production `zcztvberuihphqklhjsr`. Création confirmée `ACTIVE_HEALTHY` ; PostgreSQL **17**, région `eu-central-1`, devis de création **0 USD/mois**.
- **18/18 migrations du dépôt** exécutées avec succès sur staging. La nomenclature des versions appliquées diffère de la production : ne pas inférer une égalité d'historique de versions.
- Relevés structurels de `public` sur les deux projets : **27 tables, 27 RLS activées, 226 colonnes, 25 policies, 30 fonctions** ; MD5 des définitions de colonnes et policies concordants. Trois buckets Storage de mêmes noms : `deal-contracts`, `verification-media`, `verification-media-derived`.
- Test hébergé SQL sur staging : deux identités **fictives** insérées dans une transaction, rôle PostgreSQL `authenticated` et sous-claim JWT **simulé** A puis B. Les quatre tables `users`, `verifications`, `media_assets`, `assistant_conversations` refusent à chaque identité les lignes de l'autre et permettent la lecture des lignes propres.
- La transaction a été **ROLLBACK**. Contrôle après test : `auth.users`, `public.users`, `verifications`, `media_assets`, `assistant_conversations` et `storage.objects` sont tous à **0 ligne**.
- **Limites** : simulation de claim SQL, et non deux jetons émis par GoTrue / sessions HTTP ; aucun vrai upload Storage, E2E Worker, sauvegarde/restauration de schéma réel ni rollback applicatif testé ; protection de mots de passe compromis en **production** non modifiée.
- **Interdiction** : ne jamais pointer les tests jetables vers la production ; ne pas relancer des migrations staging déjà appliquées ; ne pas clôturer #16 sur ces seules preuves.

## Critères de clôture de l'issue #16 et livrables de preuve

| Bloc | Preuve attendue | État |
| --- | --- | --- |
| Labo SQL/PGlite et Auth simulé | Runs CI existants + SHA exact | Vérifié localement, preuves CI existantes |
| Dump/restore synthétique local | Sortie du script + version Docker/Postgres | Script préparé, **pas encore exécuté** |
| Auth/Storage/RLS A/B hébergés | Environnement, date, cas négatifs et résultat, sans PII | **SQL RLS A/B simulé sur staging réussi** ; vrais parcours Auth/HTTP/Storage non exécutés |
| Staging réellement isolé | Références, configuration et désactivation IA/billing/purge | **Projet DB/Auth/Storage créé et séparé** ; Worker staging et contrôle des flags non configurés |
| Backup/restore du schéma réel + rollback | Procès-verbal d'essai sur instance isolée, SHA et empreinte | Non exécuté |
| Auth leaked-password | Activation + test ou acceptation de risque explicite | À décider |
| Release | CI GitHub et Cloudflare vertes sur SHA exact | À vérifier lors de la livraison |

Un simple run CI vert ou le smoke test de 2 lignes **ne ferme pas #16**. Archiver un bilan horodaté indiquant `executed`, `not_executed`, `failed` ou `blocked_cost_approval` pour chaque preuve, sans secrets. Ne pas inscrire `Fixes #16` / `Closes #16` tant que les preuves distantes manquent.

## Sources techniques et tarification

- [Supabase — développement local](https://supabase.com/docs/guides/local-development/cli-workflows)
- [Supabase — développement local avec Docker](https://supabase.com/docs/guides/local-development)
- [Supabase — branches isolées](https://supabase.com/docs/guides/deployment/branching)
- [Supabase — coûts du branching](https://supabase.com/docs/guides/platform/manage-your-usage/branching)

## Publication Cloudflare Staging — préparation du 8 novembre 2026

**Statut : configuration et workflow ajoutés, Worker staging pas encore publié.** La publication exige une authentification Cloudflare non disponible dans cette conversation ; un run CI/dry-run n'est pas une publication.

- `wrangler.staging.jsonc` cible exclusivement le nouveau Worker `mentioncheck-staging`, prévu à `https://mentioncheck-staging.toto-rina47501.workers.dev`, et le projet Supabase `ukvgnkxgzyhswgpnvyzz`. Il n'importe **aucun conteneur, Durable Object ou cron**, désactive tous les appels IA, le paiement, les médias et la rétention ; `wrangler.jsonc` de production reste intact.
- Workflow GitHub Actions **MentionCheck Staging Cloudflare**, uniquement via `workflow_dispatch` sur `main` : mode `dry-run` sans publication (clé de build fictive), puis `publish`. Il vérifie les frontières, compile avec OpenNext et contrôle le bundle avant déploiement.
- Le mode `publish` requiert des secrets GitHub Actions limités au staging : `MENTIONCHECK_STAGING_CLOUDFLARE_ACCOUNT_ID`, `MENTIONCHECK_STAGING_CLOUDFLARE_API_TOKEN` (accès minimal Workers Scripts Edit dans le compte existant), `MENTIONCHECK_STAGING_SUPABASE_ANON_KEY` (clé publiable staging) et `MENTIONCHECK_STAGING_SUPABASE_SERVICE_KEY` (clé privée uniquement staging). **Ne jamais partager de valeur de clé dans un chat ou la commiter.**
- Le workflow transmet la clé publiable à Next au **build**, puis installe les clés publique et serveur comme secrets **exclusivement sur le Worker staging**. Avant toute publication, il valide les deux clés par des API du projet staging (Auth Settings / schéma PostgREST), sans afficher les clés ni les données. Aucune clé de production ne doit être copiée ; faire vérifier les identifiants staging par l'administrateur avant de lancer `publish`. Le compte Cloudflare peut facturer des requêtes selon le forfait : le coût 0 $/mois annoncé concerne **Supabase Free**, pas un budget Cloudflare garanti.
- Après succès : tester l'URL du Worker staging et les deux vrais comptes Auth sur le **staging**. La CI et les tests SQL actuels ne prouvent ni un déploiement Cloudflare ni une recette Auth navigateur. Réserver `#16` ouverte tant que les essais E2E et le backup/restore réel n'ont pas été effectués.
