# MCP distant Studio MentionCheck (MVP dev fermé)

État : **développement autorisé, production fermée**.

## Surface MVP implémentée

- Endpoint MCP : `/api/mcp` (HTTP streamable, SDK v2, modern `2026-07-28` + fallback legacy stateless du SDK).
- Tools disponibles :
  - `check_content` (`checks:write`) : entrée `{caption, platform}`, mode `rules_only`, backend `studio_execute_api`.
  - `list_verifications` (`checks:read`) : lecture des 100 dernières vérifications du workspace autorisé.

Le serveur n’expose pas `get_verification` ni les extensions Creator/Media kit/Mia/RAG/usage tant que leurs contrôles backend dédiés ne sont pas validés.

## Auth MCP (déléguée, sans clé Studio brute)

- Le client présente un bearer `mc_mcp_<payload>.<signature>`.
- Le payload signé contient : `clientId`, `scopes`, `studioKeyHash`, `exp`, `resource` **obligatoire** (audience exacte).
- Vérifications côté ressource :
  - signature HMAC (`MCP_TOKEN_HMAC_SECRET`) ;
  - expiration ;
  - audience/resource ;
  - scopes par tool (`checks:read` / `checks:write`).
- Le serveur ne lit jamais de `workspaceId` ni `userId` fournis au `tools/call`.
- Le contrôle d’équipe/plan/quota/scopes Studio reste revalidé transactionnellement par `studio_execute_api`.

## Discovery OAuth ressource

Routes `/.well-known/*` servies par le SDK MCP :

- `/.well-known/oauth-authorization-server`
- `/.well-known/oauth-protected-resource/api/mcp`

Variables requises pour servir ces documents :

- `MCP_OAUTH_ISSUER`
- `MCP_OAUTH_AUTHORIZATION_ENDPOINT`
- `MCP_OAUTH_TOKEN_ENDPOINT`
- `MCP_RESOURCE_SERVER_URL` (**obligatoire**, URL HTTPS canonique avec chemin `/api/mcp`, jamais dérivée de Host)

Optionnelles :

- `MCP_OAUTH_JWKS_URI`
- `MCP_OAUTH_REGISTRATION_ENDPOINT`
- `MCP_OAUTH_REVOCATION_ENDPOINT`
- `MCP_SERVICE_DOCUMENTATION_URL`
- `MCP_ALLOWED_ORIGINS` (origines HTTPS supplémentaires explicites, séparées par des virgules, facultatif ; aucune origine tierce n'est autorisée par défaut)

## Limites et garde-fous

- Aucun appel OpenAI ni service payant.
- Aucun endpoint de mutation billing/Stripe.
- Aucune lecture d’archives privées, media kit, progression locale créateur ou chat Mia via MCP dans ce lot.
- Erreurs sans fuite de secret/token/caption.

## Statut de sécurité et déploiement

La PR implémente **un vérificateur de bearer MCP et des documents OAuth de découverte**, pas encore un serveur d'autorisation permettant à un utilisateur de consentir, d'échanger un code, d'émettre puis de révoquer son jeton. Un HMAC signé n'est **pas à lui seul un OAuth 2.1 délégué**. Aucun endpoint d'émission MCP n'est exposé et aucune clé Studio brute ne doit être copiée dans un client.

La ressource HTTPS canonique doit être configurée explicitement ; aucun repli sur le Host de la requête. Les jetons doivent avoir une audience exacte, expirent en une heure au maximum et les appels avec `Origin` inconnu sont refusés. Les erreurs inattendues ne révèlent pas les détails internes ; les quotas Studio et la révocation de la clé sous-jacente restent vérifiés par le RPC existant.

**Statut : code MVP/CI seulement, pas de connexion réelle client MCP ni d'E2E OAuth staging certifiés. Ne pas publier comme disponible ni fusionner pour une commercialisation tant que le flux d'autorisation réel, la révocation individuelle et l'isolation A/B n'ont pas été prouvés.** Aucun secret ni service payant requis pour les tests unitaires locaux.
