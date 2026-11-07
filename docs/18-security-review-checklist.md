# Audit de sécurité indépendant — MentionCheck

Périmètre à valider sur chaque endpoint : authentification, autorisation, limites, erreurs et journalisation.

## Authentification et droits
- Exiger `getUser()` côté serveur pour les opérations privées ; ne pas faire confiance à l'identifiant fourni par le client.
- Vérifier l'appartenance à un Studio à chaque lecture, modification, invitation et révocation.
- Tester la rétrogradation d'un administrateur après création d'une invitation.
- Garantir que les politiques RLS refusent tout accès inter-tenant, y compris via RPC.

## Médias privés
- Chemin strictement lié à l'utilisateur authentifié.
- Type MIME, taille, durée de validité et état d'upload vérifiés côté serveur.
- Ne jamais accepter une URL distante arbitraire pour l'analyse IA.
- Calculer les empreintes binaires côté serveur, ne pas faire confiance à une empreinte envoyée par le navigateur.
- Ne pas conserver les URL signées dans les journaux ou rapports publics.

## API et données
- Limiter les corps JSON et le débit, y compris sur les routes Studio.
- Vérifier CSRF/origin sur les mutations sensibles si authentification par cookie.
- Éviter les erreurs SDK, clés et informations personnelles dans les réponses publiques.
- Préserver l'idempotence des écritures et des quotas ; rembourser les quotas selon la politique existante.
- Tester export et effacement RGPD, rétention des preuves et audit des actions.

## Validation
Exécuter les tests de refus (401/403/413/429), les tests SQL RLS et Playwright sans appel externe payant.

### Quotas et limites de débit — preuves locales

- `lib/security/rate-limit.ts` applique en production `API_SOLO_LIMITER` ou
  `API_PAID_LIMITER`, indexés par compte ; Wrangler configure respectivement
  30 et 120 requêtes par minute. `tests/unit/rate-limit.test.ts` simule une
  rafale de 36 tentatives, le choix du binding, le refus fermé si absent et le
  mode hors production, sans appeler Cloudflare.
- `scripts/test-sql-offline.test.mjs` soumet 40 réservations au PostgreSQL
  WASM local et vérifie que le plafond solo de 30 n’est pas dépassé.
  `tests/sql/quota_period_security.sql` couvre déjà le remboursement de chaque
  action sur la période réservée, la saturation à zéro, le quota épuisé et les
  privilèges limités au serveur. Les tests existants de `mia-cost-ledger`,
  `prepared-media-engine` et `rewrite-preferences` vérifient les remboursements
  applicatifs ; ils ne sont pas dupliqués.
- Les refus 401/403 existent déjà dans les tests de routes et
  `tests/e2e/private-navigation.spec.ts` ; les parcours Auth/RGPD de
  `docs/12-privacy-security.md` restent hors de ce périmètre.

Ces tests locaux ne prouvent ni une concurrence multi-connexion sur PostgreSQL
hébergé, ni les fenêtres distribuées de Cloudflare, ni les permissions ou
réponses d’une instance distante. Aucun test de charge, E2E distant ou contrôle
de production n’est revendiqué.

## Preuves locales du lot Auth/RGPD (issue #16)
- Playwright authentifié local: login, navigation privée, logout, refus 401/403 et refus d'origine tierce sur mutations cookie (`tests/e2e/authenticated-navigation.spec.ts`, `tests/e2e/private-navigation.spec.ts`).
- Contrôle `rules_only` et Mia sans fournisseur: flux SSE simulés, aucun appel OpenAI (`tests/e2e/check-chat-offline.spec.ts`, `tests/e2e/free-mode-opt-in.spec.ts`).
- Bibliothèque média sur assets jetables: upload opt-in et nettoyage limité aux IDs créés pendant le test (`tests/e2e/media-upload-authenticated.spec.ts`).
- Archives PDF et isolation A/B: PDF propriétaire en SQL local, refus 404 pour compte tiers (`tests/e2e/authenticated-navigation.spec.ts`).
- Isolation Studio/collaborations A/B: scénarios SQL locaux multi-acteurs avec refus cross-account (`tests/e2e/studio-sql.spec.ts`, `tests/e2e/collaborations-sql.spec.ts`).

## Preuves manquantes (non exécutées dans ce lot)
- Staging vs production: aucune exécution distante attestée ici, uniquement des contrôles locaux/offline.
- Rôle `service_role` serveur en environnement hébergé: non validé dans cette PR.
- Quotas et rate limit en trafic distribué réel: non validés ici (les preuves restent locales).
- Vérification RLS/RPC sur instance Supabase distante: non exécutée dans ce lot.
- Sauvegarde/restauration PostgreSQL et rollback complet (app + schéma) sur environnement isolé: non exécutés, runbook requis côté exploitation.

## Addendum — audit distant Supabase (lecture seule, 7 novembre 2026)

- Projet inspecté: `zcztvberuihphqklhjsr` (`ACTIVE_HEALTHY`), PostgreSQL 17, `eu-central-1`.
- Inventaire SQL confirmé: 27 tables `public` avec RLS activée; 22 ont des policies et 5 restent volontairement sans policy (`api_keys`, `law_documents`, `law_import_runs`, `stripe_webhook_events`, `workspace_invitations`).
- Migrations distantes: 18 versions présentes vérifiées; identité de contenu et restauration non démontrées par ce relevé.
- Advisor SQL: 5 WARN sur RPC `SECURITY DEFINER` exécutables par `authenticated` (`archive_brand_deal`, `delete_brand_deal_draft`, `remove_social_account`, `save_brand_deal`, `save_social_account`); garde-fous constatés (`search_path` fixé, contrôle `auth.uid()`, `anon` sans `EXECUTE`), mais couverture E2E distante d'autorisation encore manquante.
- Advisor Auth: WARN `leaked password protection disabled` toujours actif; décision admin et test sur compte jetable requis.
- Topologie: aucune branche Supabase de staging et un seul projet connecté; ne pas revendiquer d'isolation staging/prod non prouvée.

**Statut :** preuves locales ciblées pour quotas et Auth/RGPD ; aucune validation globale ni validation distante n’est revendiquée.
