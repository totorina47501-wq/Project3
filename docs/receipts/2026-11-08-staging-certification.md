# Procès-verbal de certification partielle — MentionCheck staging

**Date :** 8 novembre 2026, 20:19 UTC. **Verdict : recette applicative staging validée ; certification complète de release BLOQUÉE.**

## Références immuables

- Application réellement publiée en staging : commit `5b08082f4a54830f0537548cc5502a36bb4f9bb8` ; Worker `mentioncheck-staging`, `https://mentioncheck-staging.toto-rina47501.workers.dev/login`.
- Supabase staging : `ukvgnkxgzyhswgpnvyzz`, `ACTIVE_HEALTHY`. Production distincte `zcztvberuihphqklhjsr`.
- Code des tests : branche non fusionnée `test/mentioncheck-staging-auth-20261108`, commit `f94d71b0767a86cfcf419486a8bedc300c36ec65`.
- [Run vert #42519296878](https://github.com/totorina47501-wq/Project3/actions/runs/42519296878) : job Auth API + Playwright PASS, job PostgreSQL synthétique + comparaison statique PASS.
- [Run de base #42518079669](https://github.com/totorina47501-wq/Project3/actions/runs/42518079669) : GoTrue Auth A/B réel, 6 tables RLS, 5 RPC, Storage et nettoyage PASS.

## Porte 1 — E2E et sécurité applicative : PASS

- **Playwright distant réel :** 9 réussis, 3 ignorés car spécifiquement réservés au harnais local ; aucune simulation d'identité pour les neuf tests distants.
- Navigation authentifiée desktop/mobile, archives, Mia, déconnexion, contrôle rules_only sans IA, accès invité 401/403.
- Deux sessions de comptes Auth jetables A et B, PDF propriétaire retourné en PDF réel et refus 404 au compte A, exports RGPD authentifiés sans données du compte B.
- Auth/RLS : refus intercomptes sur 6 tables et 5 mutations RPC privilégiées ; upload privé, téléchargement et signature d'URL refusés au compte non propriétaire.
- CSRF : 403 sur origines tierces, y compris avec cookie de session authentifiée ; aucun appel à une route d'analyse IA autorisée.
- RGPD : création, aperçu `dryRun=true`, `deleted=false`, puis annulation ; aucun exécuteur destructif invoqué.
- Quotas staging : 3 réservations concurrentes sur compte jetable, lecture d'un total exact de 3, puis remboursement de 3 et vérification du retour à 0.
- Logs : `STAGING_QUOTA_CONCURRENCY_PASS`, `STAGING_BROWSER_PDF_RGPD_EXPORT_PASS`, `STAGING_BROWSER_CSRF_RGPD_PREVIEW_PASS`, `STAGING_BROWSER_MOBILE_PASS`, `STAGING_REAL_BROWSER_PASS`.

## Nettoyage indépendant : PASS

- Une trace d'audit RGPD `privacy_erasure_runs` initialement conservée par les FK `ON DELETE SET NULL` a été identifiée puis supprimée par un **DELETE ciblé sur la seule ligne de recette**, exclusivement staging. Le runner a été corrigé pour purger l'audit de ces deux comptes *avant* leur suppression Auth, sans purge globale.
- Contrôle SQL après le **dernier** run : **0** dans `auth.users`, `auth.sessions`, `public.users`, `public.verifications`, `public.media_assets`, `public.privacy_erasure_requests`, `public.privacy_erasure_runs`, `public.usage_monthly`, `public.ai_analyses`, `storage.objects`.
- Appels OpenAI payants : aucun ; flags `OPENAI_PAUSED=true`, IA, facturation, rétention et traitement média désactivés ; aucun usage IA comptabilisé.

## Porte 2 — sauvegarde/rollback : PARTIEL

- **Exécuté** : script existant `scripts/recette/isolated-postgres-restore.sh` sur Docker local PostgreSQL 17 sans réseau, `pg_dump` / `pg_restore` et empreinte identique pour deux lignes factices. Une version statique du fichier Wrangler staging est retrouvable au SHA publié et identique au fichier testé.
- **Non exécuté — blocage crédentiel** : vrai `pg_dump` du schéma hébergé staging vers base PostgreSQL isolée ; requiert une chaîne PostgreSQL staging, non les secrets `sb_publishable`/`sb_secret` HTTP déjà présents. Documenter un accès chiffré / secret GitHub avec droits minimaux avant exécution. Selon Supabase, privilégier `supabase db dump` pour filtrer les schémas système.
- **Non exécuté** : rollback effectif d'une version déployée sur Worker staging. La comparaison Git **n'est pas** un rollback opérationnel. Ne rien tenter en production.

## Porte 3 — audit : PARTIEL

- Lecture SQL **seulement**, aucun schéma ni policy modifié en production.
- Empreintes concordantes staging/prod : 27 tables RLS, 25 policies, 30 fonctions et 3 buckets privés ; hashes respectifs `acb12c0eaf7267b3fe3562a3e7fb0695`, `1cc9663609bcc57f1d02ce90fd1cb96f`, `5134d13c1a17fa853b8704da2fb34f88`, `e3331155249564f64b7edfce821d17be`.
- Supabase Health Advisor : aucune alerte. Supabase Security Advisor : 5 INFO (`rls_enabled_no_policy`, accès fermé attendu à vérifier selon usage) et 5 WARN (`SECURITY DEFINER` exécutables par `authenticated`, refus intercompte prouvés par tests).
- Protection Auth « leaked password protection disabled » : historiquement signalée dans les documents ; **état actuel non revalidé** depuis les paramètres Auth, décision administrateur nécessaire.

## Porte 4 — release : BLOQUÉE

- GitHub CI qualité du SHA `5b08082` : PASS ; Workflow manuel staging `#42517337174` : PASS ; accès HTTP staging et production : répondent.
- **Signal défavorable** : une vérification ultérieure `Workers Builds: mentioncheck` sur le SHA de production est **FAILURE** (8 novembre, 20:04 UTC, [voir le build Cloudflare](https://dash.cloudflare.com/f9b14d5d93b1fe8ef3982d3ddb87131d/workers/services/view/mentioncheck/production/builds/a8f823e5-cc10-4b68-9ad6-348b4d779583)). L'application de production restait accessible en lecture ; cette anomalie n'est ni corrigée ni déclarée verte.
- Aucun commit sur `main` depuis `5b08082`, aucun changement de configuration, purge ni déploiement en production.
- **Issue #16 reste ouverte** avec `release:evidence-required`. Ne pas revendiquer certification « Full Auto / production ready » tant que la vraie restauration, le rollback distant, la politique Auth et le build rouge ne sont pas levés.

## Suite minimale

1. Diagnostiquer le build Cloudflare production en lecture seule et lever l'échec sans déploiement aveugle.
2. Fournir par un canal de secrets sécurisé un accès PostgreSQL **staging uniquement**, préparer la restauration du vrai schéma sur une instance jetable ; vérifier policies / fonctions / contraintes.
3. Effectuer un rollback contrôlé **staging seulement**, puis revalider la page login.
4. Relever/valider la politique Auth compromised passwords avec administrateur et archiver la preuve. Fermer #16 seulement quand ces quatre preuves sont réunies.

## Addendum diagnostic Cloudflare — 8 novembre, 20:46 UTC

- [GitHub diagnostic en lecture seule #42521699568](https://github.com/totorina47501-wq/Project3/actions/runs/42521699568) : le build Cloudflare échoué exécute `npx opennextjs-cloudflare build` (**succès**) puis `npx wrangler preview` (**échec**).
- Message exact : `Your Wrangler configuration needs a previews block to run this command.` Le fichier `wrangler.jsonc` de `main` n'a pas de bloc `previews` ; Wrangler `4.156.2` prend en charge cette configuration.
- Correctif **proposé uniquement dans la PR draft #99** : ajouter `previews.vars` qui utilise exclusivement l'URL Supabase staging et qui désactive IA, paiement, analyse média, rétention et containers. Il n'ajoute ni secrets ni bindings vers la production. Le contrat `scripts/recette/check-cloudflare-preview-boundary.mjs` refuse toute référence Supabase production ou activation payante.
- Cela traite l'erreur `previews` **constatée**, mais ne prouve pas que le prochain build Cloudflare fonctionnera : aucune publication de `main` ni mise à jour des paramètres Cloudflare ne sera effectuée dans ce lot.
- Le même diagnostic recense **quatre déploiements** du Worker staging. Les versions historiques ont des états de secrets potentiellement différents ; **ne jamais** exécuter un rollback automatique aveugle vers une de ces versions. Il faut préparer deux versions complètes et vérifiées (secrets inclus), tester et restaurer le Worker staging seulement.
- L'organisation Supabase est confirmée `plan=free` ; la protection native contre les mots de passe compromis est réservée à Pro et supérieur d'après la documentation Supabase. **Aucun changement de forfait ou activation payante** ; documenter le risque pour le lancement. `#16` reste ouverte.


## Addendum du 8 novembre, 20:57 UTC — rollback Cloudflare staging réellement exécuté

[Run #42522596101](https://github.com/totorina47501-wq/Project3/actions/runs/42522596101) : **SUCCESS** (commit de test 166433bf82bfcdb104fb99d189e493ec6aef480e).

- Le script a d'abord vérifié en lecture seule le déploiement actif de référence, exact \`d98664b3-26ee-41fa-be7d-ca4b8672137e\`, et la présence des deux noms de secrets Supabase. Si la référence avait changé, il aurait refusé toute écriture.
- Un \`wrangler secret put SUPABASE_SERVICE_KEY\` a créé une **deuxième version complète** avec la **même clé staging**, sans changement de code ni de valeur. Cette version a été contrôlée avec les deux secrets et le smoke login + refus d'accès invité.
- \`wrangler rollback d98664b3-26ee-41fa-be7d-ca4b8672137e --name mentioncheck-staging\` a restauré la version saine d'origine. L'API Cloudflare confirme le retour de la version active à cette référence ; smoke final \`STAGING_HEALTH_OK_AFTER_ROLLBACK\`.
- Logs : \`STAGING_ROLLBACK_SECOND_SAFE_VERSION_CREATED\`, \`STAGING_REAL_ROLLBACK_OPERATION_PASS\`. Après run, connexion HTTP staging et production toutes deux accessibles.
- **Portée exacte :** rollback opérationnel de **versions Worker** avec changement non fonctionnel de secret ; **pas** encore démonstration de rollback entre deux codes applicatifs différents ni de migrations SQL. La partie « rollback opérationnel » passe à **PASS (mécanisme)**, la preuve de rollback de code d'une nouvelle release reste à prévoir.
- Production non ciblée, aucun appel IA ni paiement ; le worker historique \`mentioncheck-staging\` seulement.

**Blocages restant pour la certification complète :** vrai dump/restore du schéma Supabase staging sur une instance isolée (accès DB non fourni), configuration de build Cloudflare corrigée uniquement dans la PR draft mais non encore déployée/revalidée sur production, et décision administrateur sur la protection de mots de passe compromis (plan Free ne la propose pas). L'issue #16 reste ouverte.
