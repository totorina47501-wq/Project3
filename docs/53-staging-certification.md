# Certification MentionCheck — staging, 8 novembre 2026

**Dernière preuve Cloudflare (9 novembre 2026)** : [cycle réel Preview staging HTTP 200, refus invité, suppression par ID, restauration URLs désactivées — GitHub #42540861095](https://github.com/totorina47501-wq/Project3/actions/runs/42540861095) : **PASS**. La PR #99 reste draft ; build Workers de production non revalidé, Auth compromised passwords toujours à décider. [Procès-verbal du 9 novembre](receipts/2026-11-09-cloudflare-preview-diagnostic.md).


**Dernière preuve (8 novembre) :** [Restauration vraie du schéma staging sur Supabase local — run #42528880867](https://github.com/totorina47501-wq/Project3/actions/runs/42528880867) : PASS pour `public`, `privacy_internal`, `studio_private`, 9 catégories d'empreintes contrôlées. [Procès-verbal complet](receipts/2026-11-08-staging-certification.md). Blocages restants : build Cloudflare hors PR draft et décision Auth. Historique de préparation conservé ci-dessous.


**Résultats distants vérifiés** : [procès-verbal de recette 8 novembre](receipts/2026-11-08-staging-certification.md). Tests navigateur 9 PASS / 3 skips ; restauration vraie du schéma non exécutée ; rollback opérationnel staging désormais PASS (run #42522596101), sans changement de code.

Statut initial : **recette en cours sur branche isolée**. Les résultats doivent être confrontés aux runs, jamais déduits de l'existence du code.

## Périmètre

- Branche `test/mentioncheck-staging-auth-20261108` non fusionnée ; référence applicative réellement publiée `5b08082f4a54830f0537548cc5502a36bb4f9bb8`.
- Supabase **staging** `ukvgnkxgzyhswgpnvyzz` et Worker `mentioncheck-staging`. Projet production `zcztvberuihphqklhjsr` **non ciblé**.
- Tous les appels IA, paiements, traitement média payant et cron rétention désactivés. Pas de service externe supplémentaire, ni emails, ni données clients.
- Secrets présents uniquement dans GitHub Actions ; identités jetables créées en mémoire et supprimées en `finally`.

## Matrice de preuves

| Porte | Contrôle | État avant run |
| --- | --- | --- |
| 1 — Vrais parcours navigateur | Réutilisation de `authenticated-navigation.spec.ts`, `private-navigation.spec.ts`, `free-mode-opt-in.spec.ts`; nouvelle spec minimale pour A/B, mobile et PDF | `not_executed` |
| 1 — RLS / CSRF / quotas / RGPD | GoTrue A/B, 5 RPC, Storage, origines interdites, quota transactionnel 3 réservations/3 remboursements, export et preview RGPD sans suppression | `not_executed` |
| 2 — Restauration mécanique | Docker PostgreSQL 17 jetable, `pg_dump` + `pg_restore`, empreinte 2 fixtures ; **pas de schéma Supabase réel** | `not_executed` |
| 2 — Restauration schéma hébergé | `pg_dump --schema-only` du vrai staging et `pg_restore` sur **autre instance** isolée avec pgvector/extensions | `blocked_credentials` |
| 2 — Retour version applicative | Comparaison du fichier Wrangler au SHA staging publié ; **aucun rollback Cloudflare réel entre codes différents** | `not_executed` |
| 3 — Security advisor Auth/RLS | Recenser avertissements, preuve réelle CSRF/RGPD, activation protection mots de passe compromis soumise à validation admin | `partial` |
| 4 — Release | CI + Cloudflare sur SHA exact, contrôles après nettoyage et preuves GitHub issue #16 | `pending_evidence` |

La clé `sb_secret_...` Supabase n'est **pas** un mot de passe PostgreSQL pour `pg_dump` ; aucune restauration du schéma hébergé ne peut être revendiquée à partir du test mécanique seul.

## Preuve antérieure

[Run #42518079669](https://github.com/totorina47501-wq/Project3/actions/runs/42518079669) : Auth GoTrue réelle, six tables RLS A/B, cinq RPC, upload privé, déconnexion et suppression vérifiés indépendamment (zéro compte et zéro objet après passage).

## Actions de certification encore obligatoires

- Obtenir un accès **en lecture uniquement au Postgres staging**, puis sauvegarder et restaurer le vrai schéma (pas ses données clients) dans une base temporaire différente, comparer contraintes, policies, fonctions, extensions.
- Tester un retour arrière **du Worker staging seulement** et vérifier l'URL ; ne pas tester un rollback de production.
- Déterminer avec l'administrateur la politique Auth « leaked password protection disabled », vérifier configuration et conserver preuve.
- Laisser issue #16 ouverte et label `release:evidence-required` tant que des portes restent sans preuve.
