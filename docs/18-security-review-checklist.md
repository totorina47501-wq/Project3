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

**Statut :** points de contrôle préparés ; aucune validation de sécurité globale n'est revendiquée.
