# BLOC 2 — Schéma Supabase et policies RLS

**Chemin :** `docs/02-database.md`  
**Date :** 03 novembre 2026  
**Statut :** migrations livrées en Git, exécution Supabase non encore vérifiée.

## Installation

Ouvrir un projet Supabase disposant des schémas `auth`, `storage` et `extensions` puis appliquer dans cet ordre :

```bash
supabase db push
supabase db execute --file supabase/seed.sql
```

Pour les projets Supabase CLI où `db execute` n'est pas disponible, exécuter `supabase/seed.sql` via le SQL Editor (rôle administrateur) ou `psql` avec la chaîne de connexion sécurisée.

Les migrations portent les horodatages `202611032001`, `202611032002`, `202611032003`.
Pour un test local, utiliser `supabase start`, puis `supabase db reset` qui applique les migrations et le seed.

## Modèle de données

| Table | Objet | Visibilité navigateur |
|---|---|---|
| `users` | Profil, plan synchronisé, consentement IA | Lecture personnelle ; mise à jour limitée à `ai_training_opt_in` |
| `social_accounts` | Comptes reliés, référence du secret Vault | Lecture personnelle des colonnes publiques |
| `verifications` | Contrôles multimodaux, score, explication, réécriture et SHA-256 | Lecture personnelle |
| `ai_analyses` | Coûts, tokens, latence et payload brut | Lecture personnelle des métadonnées ; payload réservé au serveur |
| `compliance_rules` | R1–R8 versionnées, source et nature | Lecture authentifiée |
| `brand_deals` | Collaborations, contrat privé et empreinte | Lecture personnelle |
| `assistant_conversations` | Conversation Mia et lien éventuel à une vérification | Lecture personnelle |
| `subscriptions` | Synchronisation Stripe côté webhook | Lecture personnelle |
| `law_documents` | Corpus officiel, synthèse et vecteurs 1536 | Accès backend uniquement |
| `usage_monthly` | Compteurs mensuels destinés aux quotas atomiques | Lecture personnelle |
| `rewrite_feedback` | Texte initial, texte accepté et consentement historique | Lecture personnelle limitée aux métadonnées |

### Stratégie d'authentification

- L'authentification et le hash du mot de passe restent dans `auth.users`.
- La colonne `public.users.password_hash` est conservée pour compatibilité avec le cahier des charges mais un `CHECK` interdit explicitement de l'alimenter.
- Le trigger `public.handle_new_user()` crée le profil lors de l'inscription Supabase.
- Les rôles `anon` et `authenticated` n'ont aucun droit d'écriture sur les résultats IA, l'abonnement, le corpus juridique ou les quotas.
- L'API serveur utilise les sessions authentifiées, puis un accès contrôlé `service_role` **strictement serveur** ; il est interdit d'exposer cette clé dans le frontend.
- `password_hash`, le secret Vault et `raw_response` ne sont pas accessibles via la sélection du navigateur.

### RLS, isolation et archivage

- RLS actif sur les 11 tables applicatives.
- Une conversation Mia ne peut être rattachée à la vérification d'un autre compte grâce à une clé étrangère composite `(verification_id, user_id)`.
- Les vérifications finalisées conservent leurs entrées d'origine et leur hash ; les contrats archivés ne peuvent pas être réécrits.
- Les buckets `verification-media` (50 Mio) et `deal-contracts` (10 Mio) sont privés.
- Le chemin de fichier suit `<auth.uid()>/<uuid>.<extension>` et le stockage applique des règles RLS.
- Une suppression de compte implique la suppression des lignes associées. Pour un effacement effectif, les fichiers Storage, secrets Vault et autres données sous-traitées devront aussi être purgés par un flux serveur.

### Score de conformité et scoring IA

- `verifications.ai_score` = **score de conformité 0..100** (100 favorable).
- `ai_risk_level` = niveau `low`, `medium`, `high` ou `critical`.
- Le niveau de risque doit refléter la gravité des violations et pas seulement un seuil arithmétique.
- `raw_response` stocke les charges utiles du modèle ; minimiser ou caviarder les données personnelles avant persistance.

### Sources juridiques actualisées

Les cinq résumés indexables couvrent les articles **1, 3, 4, 5 et 5-2** de la loi 2023-451, consolidée en 2026.

- Article 1 : définition de l'influence commerciale.
- Article 3 : application des règles générales de publicité.
- Article 4 : restrictions de promotion, dernière version en vigueur depuis le 1er juillet 2026.
- Article 5 : images retouchées / images virtuelles.
- Article 5-2 : obligation d'indication de l'intention commerciale, introduit par l'ordonnance n°2024-978 du 6 novembre 2024.

Source officielle : https://www.legifrance.gouv.fr/loda/id/LEGITEXT000047665795/2026-10-19

**R1–R8** ne doivent pas être annoncées comme huit infractions légales. Notamment R2 (125 caractères), R3 (hashtags finaux), R4 (logo), R6 (expressions ambiguës) et R7 (majuscules/gras) sont des indices ou heuristiques de détection. R8 sert l'intégrité technique. Le seul logo ne démontre pas l'intention commerciale.

### Recherche sémantique (RAG)

La fonction `match_law_documents` accepte un `vector(1536)`, une limite plafonnée à 10 résultats et un seuil de similarité. Elle est exécutable uniquement par `service_role`.
Les embeddings sont vides au premier seed : ils seront générés par le job d'indexation `text-embedding-3-small` du bloc 7.
Le RAG retournera des passages documentés, non des citations inventées.

### Vérifications SQL

Après avoir appliqué les migrations + le seed, exécuter `tests/sql/security_smoke.sql` dans le SQL Editor de Supabase ou via `psql`. Ce contrôle vérifie les 11 tables RLS, les 8 règles, le corpus de droit et les permissions sensibles. Le fichier n'a pas été exécuté sur une vraie instance Supabase dans ce lot.

### Évolutions prévues

- Bloc 3 : orchestration et usage contrôlé des tables `verifications`, `ai_analyses`, `rewrite_feedback`.
- Bloc 6 : webhooks Stripe, contrôles atomiques de quotas côté API et vérifications des autorisations.
- Bloc 7 : ingestion réelle du corpus officiel, embeddings et versionnage documentaire.
- Bloc 8 : politiques de conservation des données et purge des objets externes.


## Actualisation 2026-11-04

Migration 202611042001_mia_quota_and_append.sql exécutée sur Supabase. Quotas Mia mensuels : Solo 20 / Pro 300 / Studio 1500, consommation atomique et remboursement. La fonction append_mia_exchange ajoute deux messages de façon transactionnelle, propriété contrôlée par user_id. Les fonctions sont strictement réservées au service_role et interdites au rôle authenticated. Le corpus juridique contient 5 synthèses et 0 embeddings : la recherche est donc lexicale, pas encore pgvector.

## Migrations du lot sans IA (2026-11-04)

202611042002_media_assets.sql : table RLS pour préparer les médias, propriétaire en lecture, écriture serveur. 202611042003_stripe_event_inbox.sql : événements Stripe test signés, déduplication, accès service_role uniquement. Le stockage porte des expirations logiques ; la purge physique doit encore être automatisée.
