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

**Statut :** preuves locales ciblées ajoutées ; aucune validation de sécurité
globale ni validation distante n’est revendiquée.
