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
- Le payload signé contient : `clientId`, `scopes`, `studioKeyHash`, `exp`, `resource` optionnel.
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

Optionnelles :

- `MCP_OAUTH_JWKS_URI`
- `MCP_OAUTH_REGISTRATION_ENDPOINT`
- `MCP_OAUTH_REVOCATION_ENDPOINT`
- `MCP_SERVICE_DOCUMENTATION_URL`
- `MCP_RESOURCE_SERVER_URL` (sinon dérivé de l’origine vers `/api/mcp`)

## Limites et garde-fous

- Aucun appel OpenAI ni service payant.
- Aucun endpoint de mutation billing/Stripe.
- Aucune lecture d’archives privées, media kit, progression locale créateur ou chat Mia via MCP dans ce lot.
- Erreurs sans fuite de secret/token/caption.
