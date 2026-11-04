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

**Statut :** points de contrôle préparés ; aucune validation de sécurité globale n'est revendiquée.
