# MentionCheck — procès-verbal de certification technique interne

**Date :** 10 novembre 2026

**Verdict :** certification technique globale **PARTIELLE**, ouverture commerciale **NON CERTIFIÉE**. La présente preuve consolide les résultats existants ; aucune opération distante, migration, publication ou mutation n'a été exécutée dans cette reprise.

## Référence et portée

- `main` au début de la reprise : `3c01a63d80a1eb45656490384ef1e732c79d3308`.
- CI GitHub de `main` : [run #42905450793](https://github.com/totorina47501-wq/Project3/actions/runs/42905450793), **SUCCESS** au SHA exact ci-dessus. Ce résultat ne certifie pas à lui seul un build Cloudflare ou un runtime.
- Les preuves staging ci-dessous portent leurs propres SHA et dates ; elles ne sont pas des preuves d'exécution sur le SHA courant de `main`.
- Environnement de production : aucune écriture, aucun déploiement, paiement Stripe Live, email réel ni appel OpenAI payant. Les flags promotion/facturation ne sont pas activés.
- La PR OAuth Copilot [#125](https://github.com/totorina47501-wq/Project3/pull/125) reste ouverte : aucun fichier de ce lot n'est modifié ici.
- Correctif de reprise appliqué dans ce lot : `scripts/recette/studio-api-staging-smoke.mjs`, `.github/workflows/mentioncheck-studio-api-staging.yml` et `.github/workflows/mentioncheck-launch-staging-auth.yml` acceptent explicitement la branche `codex/codex-certification-six-chantiers` en plus des branches historiques, pour relancer les recettes staging sans élargir le périmètre.

## Matrice des six chantiers

| Chantier | Statut | Preuve (run + SHA) | Réserve précise |
|---|---|---|---|
| Rollback interversions | **BLOCKED** | [Run #42522596101](https://github.com/totorina47501-wq/Project3/actions/runs/42522596101), **SUCCESS**, SHA `166433bf82bfcdb104fb99d189e493ec6aef480e`. | Le run a créé une seconde version staging en réécrivant un secret avec sa valeur existante, puis a réellement exécuté `wrangler rollback` vers la version initiale et vérifié HTTP. Le code applicatif n'a pas changé entre les versions : le scénario requis A/B avec deux SHA différents, vérification de compatibilité de schéma et retour à l'état attendu n'est donc pas attesté. À réexécuter sur le seul Worker staging dans une fenêtre explicitement approuvée. |
| Sauvegarde/restauration PostgreSQL | **PARTIAL** | [Run #42528880867](https://github.com/totorina47501-wq/Project3/actions/runs/42528880867), **SUCCESS**, SHA `58ca05fd5594510f617db09fa554455c16b3e16a`. | Un dump `schema-only` du PostgreSQL staging a été restauré dans Supabase local jetable ; comparaison documentée de 9 catégories (27 tables, 226 colonnes, 156 contraintes, 82 index, 25 policies, 14 triggers, 33 enums, 30 fonctions publiques, 3 privées). Cette preuve précède les migrations Studio et promotion de novembre 10 et ne couvre pas explicitement privilèges/extensions ni sauvegarde de données. Le schéma courant doit être restauré et contrôlé à nouveau ; le secret attendu par la recette est `MENTIONCHECK_STAGING_POSTGRES_URL`. |
| Migration quotas/promotion | **PARTIAL** | Décision opérateur et états staging documentés dans [#6771222649](https://github.com/totorina47501-wq/Project3/issues/16#issuecomment-6771222649) et [#6772198865](https://github.com/totorina47501-wq/Project3/issues/16#issuecomment-6772198865) ; CI `main` [#42855278823](https://github.com/totorina47501-wq/Project3/actions/runs/42855278823), SHA `88e2b9fee56722f0e184d960712e11b4d886fe5b`, **SUCCESS**. | Quotas Gratuit/Solo migrés sur staging (`20261110090032`) et promotion staging installée (`20261110155234`), avec zéro octroi promotionnel ; les tests SQL locaux couvrent droits et expiration, mais la matrice distante complète (concurrence, changement de mois, remboursements et priorités d'abonnement) n'est pas attestée ici. La migration quotas n'est pas appliquée en production : deux profils historiques dépassent le futur quota Gratuit et n'ont pas d'abonnement Stripe actif. `PROMO_SOLO_ENABLED=false` ; aucun des deux comptes n'a commencé ses 30 jours. |
| Sécurité | **PARTIAL** | [Run Auth/RLS A/B #42519296878](https://github.com/totorina47501-wq/Project3/actions/runs/42519296878), **SUCCESS**, SHA `f94d71b0767a86cfcf419486a8bedc300c36ec65` ; [recette Auth staging #42852738075](https://github.com/totorina47501-wq/Project3/actions/runs/42852738075), **SUCCESS**, SHA `223b92c15c99d7876eb5bbf316cbe99a2ee7dccd`. | Les recettes précédentes couvrent des identités jetables, refus A/B, CSRF, Auth et nettoyage. La revue des cinq RPC `SECURITY DEFINER` demeure statique et ne remplace pas des tests d'autorisation distants complets sur le candidat courant ; l'usage exclusif serveur de `service_role` et l'isolation staging/prod restent à revalider. Supabase Free n'offre pas la détection native des mots de passe compromis : le risque et les limites sont documentés, pas techniquement éliminés. |
| RGPD | **PARTIAL** | Parcours Auth/export/aperçu RGPD et nettoyage synthétique dans [run #42519296878](https://github.com/totorina47501-wq/Project3/actions/runs/42519296878), **SUCCESS**, SHA `f94d71b0767a86cfcf419486a8bedc300c36ec65`. | Export propriétaire, aperçu `dry_run` non destructif et nettoyage des identités/objets de recette sont couverts par cette recette. L'effacement reste `prepared_disabled` : aucun exécuteur complet ne supprime SQL, Storage, Auth, clés, sessions et données fournisseurs. Aucune purge réelle ni suppression d'utilisateur de production n'est revendiquée. |
| E2E final + API Studio | **PARTIAL** | E2E staging : [run #42519296878](https://github.com/totorina47501-wq/Project3/actions/runs/42519296878), **SUCCESS** (9 réussis, 3 ignorés) ; API Studio : [run #42859771039](https://github.com/totorina47501-wq/Project3/actions/runs/42859771039), **SUCCESS**, SHA `136945a25d80c0d5935b690d72cabe746d71409c` ; CI `main` : [run #42905450793](https://github.com/totorina47501-wq/Project3/actions/runs/42905450793), **SUCCESS**, SHA `3c01a63d80a1eb45656490384ef1e732c79d3308`. | Studio staging a validé clés/scopes, expiration/révocation, isolation, abonnement synthétique, refus quota HTTP 429 et nettoyage. Les E2E s'appliquent à des SHA antérieurs ; aucune recette complète sur le SHA candidat courant, ni vérification du Worker Cloudflare de ce SHA et de son runtime final n'est produite dans ce lot. Les workflows de recette Auth/API ont été ajustés pour autoriser explicitement la branche de reprise, mais l'exécution distante sur ce nouveau SHA reste à lancer/attester. |

## Vérifications locales hors ligne

Sur le checkout de cette PR (base `main` `3c01a63d80a1eb45656490384ef1e732c79d3308`), après `npm ci --ignore-scripts` :

- `npm run work:check` : **PASS**, 26 fonctionnalités, 37 routes, 21 migrations sans doublon.
- `npm run work:test` : **PASS**, 5 tests.
- `npm run docs:links` : **PASS**, aucun lien interne cassé ; `npm run docs:links:test` : **PASS**, 7 tests.
- `npm run test:sql:offline` : **PASS**, 20 migrations et 13 suites de régression SQL. Le harnais précise qu'il ne valide pas pgvector, Auth ou Storage réels.
- `npm test -- tests/unit/studio-routes.test.ts tests/unit/auth-diagnostics.test.ts tests/unit/quota-period.test.ts tests/unit/privacy-personal-data.test.ts tests/unit/privacy-erasure-plan.test.ts` : **PASS**, 5 fichiers, 28 tests.
- `npm run test:fixtures` : **PASS**, 6 tests (fixtures SQL Studio/collaborations hors réseau).
- `npm run typecheck` : **PASS**.
- `npm run lint` : **PASS**.
- `OPENAI_PAUSED=true BILLING_ENABLED=false NEXT_TELEMETRY_DISABLED=1 npm run build` : **PASS**.
- Après correctif, les deux workflows staging se déclenchent bien sur ce SHA : [Auth staging #42906686340](https://github.com/totorina47501-wq/Project3/actions/runs/42906686340) et [Studio API staging #42906686505](https://github.com/totorina47501-wq/Project3/actions/runs/42906686505), tous deux en **action_required** sans jobs exécutés (en attente d'approbation/permissions GitHub). La preuve distante de recette sur ce SHA reste donc **BLOCKED**.

## Portes et dépendances restant ouvertes

1. **Rollback staging interversions :** approbation explicite de l'opérateur, deux SHA de code distincts, versions complètes vérifiées, smoke des routes publiques/privées, retour à A et contrôle du schéma. Ne jamais viser le Worker de production.
2. **PostgreSQL staging courant :** accès protégé via `MENTIONCHECK_STAGING_POSTGRES_URL`, exécution de `scripts/recette/staging-hosted-schema-restore.sh` vers l'instance jetable et comparaison actualisée incluant Studio/promotion, policies, contraintes, fonctions, triggers, extensions et privilèges. Ne pas exporter de lignes utilisateur.
3. **Quotas :** recette staging ciblée avant toute décision de production. Pas de migration production, attribution promotionnelle, démarrage des 30 jours ni changement de facture sans sauvegarde/restauration et GO séparé.
4. **Sécurité et RGPD :** revue indépendante sur SHA candidat, limites Auth Free, tests dynamiques des RPC et `service_role`, cycle d'effacement synthétique complet seulement après définition et validation du modèle de rétention.
5. **Release :** contrôle CI, build Cloudflare et smoke du Worker réellement exécuté sur le SHA candidat ; l'actuelle preuve CI `main` ne remplace pas cette vérification.
6. **Dépendances externes de lancement :** immatriculation EI/micro, fiscalité et documents légaux/CGV, configuration et activation Stripe Live, preuve du hard limit OpenAI 25 USD avec alerte 20 USD, et éventuel accès PostgreSQL staging.

**Décision :** conserver l'issue #16 ouverte et le label `release:evidence-required`. La CI verte valide une étape technique seulement ; les six chantiers ne sont pas tous certifiés et MentionCheck n'est pas déclaré prêt commercialement.
