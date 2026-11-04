# Studio : équipes, clés et divulgation commerciale

État : code préparé sur la branche. La migration doit être appliquée séparément après revue. Aucun abonnement modifié, aucun email envoyé, aucune IA appelée. Les tests locaux ne prouvent ni un déploiement Supabase/Cloudflare ni un parcours authentifié en production.

## Propriété des données

Le propriétaire doit déjà avoir `public.users.plan = 'studio'` en base. Un espace par propriétaire. Ses invités peuvent avoir leur propre plan Solo/Pro : ils accèdent uniquement à l'espace partagé, tant que le propriétaire conserve son plan Studio. Une baisse de plan bloque les lectures RLS, les opérations serveur et les clés API. Aucune autorisation ne dépend de `user_metadata`, d'un plan ou d'une identité reçus dans le JSON.

Les vérifications d'équipe sont de nouvelles lignes dans `workspace_verifications`, avec `workspace_id` obligatoire. Aucune requête Studio ne joint `verifications`, `brand_deals` ou `assistant_conversations`. Rejoindre une équipe ne partage jamais l'historique privé. Les textes saisis dans Studio sont explicitement présentés comme partagés avant envoi.

Tables :

- `workspaces(id, owner_id, name, created_at)` ; propriétaire unique, FK `users` restrictive à la suppression.
- `workspace_members(workspace_id, user_id, role, joined_at)` ; propriétaire, administrateur ou membre.
- `workspace_invitations(id, workspace_id, email, role, token_hash, created_by, expires_at, accepted_at, accepted_by, revoked_at, created_at)`.
- `api_keys(id, workspace_id, created_by, name, token_hash, prefix, scopes, created_at, expires_at, revoked_at)`.
- `workspace_verifications(id, workspace_id, created_by, platform, caption, result, created_at)`.

Un retrait de membre ne supprime pas les textes déjà partagés. La suppression d'un compte non propriétaire retire son membership et anonymise ses références `created_by`/`accepted_by`. Ses clés cessent de fonctionner, même si leur ligne conserve sa date d'expiration. La suppression d'un propriétaire est bloquée par FK : il faut traiter explicitement l'espace partagé avant effacement ; aucune suppression collective ou réattribution automatique n'est effectuée.

## Permissions et sièges

| Opération | Propriétaire | Administrateur | Membre |
| --- | --- | --- | --- |
| Lire membres, textes, rapport | oui | oui | oui |
| Créer un contrôle texte partagé | oui | oui | oui |
| Inviter / révoquer une invitation membre | oui | oui | non |
| Inviter un administrateur / gérer son invitation | oui | non | non |
| Changer un rôle admin/membre | oui | non | non |
| Retirer un membre | oui | oui | non |
| Retirer un administrateur | oui | non | non |
| Créer / révoquer une clé d'équipe | oui | oui | non |

Le propriétaire ne peut être retiré ou rétrogradé. Aucun transfert de propriété ni suppression d'espace n'est proposé. Les membres et invitations non expirées/révoquées/acceptées réservent ensemble au maximum cinq sièges, propriétaire compris. Une invitation expire après sept jours. L'acceptation exige l'email vérifié Supabase Auth exact, consomme le jeton dans la même transaction et refuse les membres déjà présents.

Les opérations prennent un verrou sur l'espace, puis sur les jetons/clés concernés. Cela sérialise acceptations, réservations de siège, retraits et révocations. Les vérifications de rôle et de plan sont répétées dans la transaction SQL, y compris pour les clés API. La révocation prend effet pour les opérations qui commencent après sa validation ; une opération déjà engagée peut terminer avant la transaction de révocation.

## Secrets

Jetons et clés : 256 bits aléatoires via Web Crypto. Le serveur stocke exclusivement leur empreinte SHA-256. Les secrets sont renvoyés une seule fois, lors de la création, avec `Cache-Control: private, no-store`, puis affichés localement jusqu'à fermeture/nouvelle action/rechargement. Ils ne sont placés dans aucune URL, aucun stockage navigateur, aucun journal applicatif. Aucune route de relecture du secret n'existe. Le préfixe affichable d'une clé révèle seulement un fragment du secret.

L'invitation est remise manuellement à la personne invitée par un canal de confiance. Une invitation révoquée ne retire pas un membre qui l'avait déjà acceptée : utiliser le retrait de membre. Les clés expirent après 90 jours ; vingt clés actives maximum par équipe. Retirer ou rétrograder un administrateur révoque ses clés et ses invitations encore en attente. L’acceptation vérifie aussi que l’auteur de l’invitation appartient toujours à l’équipe avec le rôle nécessaire ; un auteur supprimé ne laisse aucune invitation utilisable. Leur usage exige aussi que leur créateur soit encore owner/admin.

Ne jamais inclure `token_hash` dans un export utilisateur. Les métadonnées d'une invitation peuvent également contenir l'email personnel d'un tiers : l'export doit limiter ses lignes et colonnes à la personne concernée.

## API de session

`GET /api/studio` retourne les espaces accessibles. `GET /api/studio?workspaceId=<uuid>` retourne l'espace, le rôle, les membres, les métadonnées de gestion autorisées, les cent derniers textes partagés et leur rapport. Les membres ordinaires ne reçoivent aucune invitation/clé. Les administrateurs ne reçoivent pas les invitations administrateur.

`POST /api/studio` exige la session et une origine explicite identique au site. Corps JSON stricts :

- `{"action":"create_workspace","name":"Mon équipe"}`
- `{"action":"accept_invitation","token":"mc_invite_…"}`
- `{"action":"invite","workspaceId":"<uuid>","email":"invite@example.test","role":"member"}`
- `{"action":"revoke_invitation","workspaceId":"<uuid>","id":"<uuid>"}`
- `{"action":"remove_member","workspaceId":"<uuid>","userId":"<uuid>"}`
- `{"action":"set_role","workspaceId":"<uuid>","userId":"<uuid>","role":"admin"}`
- `{"action":"create_key","workspaceId":"<uuid>","name":"Intégration","scopes":["checks:read","checks:write"]}`
- `{"action":"revoke_key","workspaceId":"<uuid>","id":"<uuid>"}`
- `{"action":"check","workspaceId":"<uuid>","caption":"Publicité…","platform":"instagram"}`

## API avec clé

`Authorization: Bearer mc_studio_<64 caractères hexadécimaux>` ; aucun cookie ni identifiant d'équipe client requis. La clé détermine son équipe. Ne pas utiliser cette clé dans une application publique côté navigateur.

- `GET /api/v1/verifications` exige `checks:read` et retourne `{items, limit:100}` (les plus récentes d'abord).
- `POST /api/v1/check` exige `checks:write` et reçoit strictement `{"caption":"Publicité…","platform":"instagram"}` ; retourne HTTP 201 et `{verification}`.

Plateformes : instagram, tiktok, youtube, linkedin. Texte de 1 à 10 000 caractères après trim. Les champs `execution`, média, `workspaceId`, `userId` et `plan` sont refusés sur cette API. Les mutations Studio et v1 bornent la lecture du corps à 64 Kio UTF-8, en contrôlant à la fois Content-Length et les octets du flux ; un dépassement annule la lecture et retourne 413. La syntaxe Bearer est refusée avant toute lecture sur v1/check ; sa validité et ses scopes restent contrôlés ensuite en base. La limitation Cloudflare existante est appliquée aux contrôles et requêtes par clé ; aucun quota IA n'est consommé. Une clé absente/mal formée donne 401, une clé non autorisée/expirée donne 403. Les erreurs de conflit donnent 409 ; les dépendances indisponibles donnent 503, sans exposer les messages SDK.

## Moteur et rapport

`lib/studio/report.ts` compose exclusivement `applyRules`, `riskFrom` et `levelFromRisk` de `lib/ai/rules.ts`. Il ne crée pas un second moteur et n'appelle aucun fournisseur. Le moteur personnel de persistance n'est pas utilisé, puisqu'il écrirait dans une table privée.

Le rapport de brand safety est limité à la divulgation commerciale : score moyen, répartition des risques et décompte par règle, recalculés de façon déterministe sur les cent derniers textes autorisés du seul workspace demandé. L'appartenance explicite est vérifiée à nouveau avant agrégation. Il ne mesure ni la réputation de marque ni tous les risques légaux. Le score reste indicatif, sans certification ni conseil juridique. Un échantillon vide donne une moyenne `null`.

## SQL et vérification

Les RPC `studio_execute(p_actor uuid, p_workspace uuid, p_action text, p_payload jsonb)` et `studio_execute_api(p_hash text, p_action text, p_payload jsonb)` sont exclusivement exécutables par `service_role`. L'acteur est extrait de `requireUser()` côté serveur. Les tables n'acceptent aucune écriture `authenticated`. Les lectures membres/workspaces/textes sont soumises à RLS ; le helper `studio_private.is_member(uuid)` est privé, utilise `auth.uid()` et vérifie le plan du propriétaire. Invitations et clés n'ont aucun accès direct `authenticated`, même à leurs empreintes. Les fonctions privilégiées fixent `search_path=''` et utilisent des noms qualifiés.

Tests : quatre suites unitaires Studio (règles/secrets, HTTP/corps bornés, écran initial, rôle du formulaire d’invitation) et `tests/sql/studio_security.sql`. Le harnais `npm run test:sql:offline` a exécuté les migrations et scénarios Studio dans PostgreSQL WASM PGlite, avec Auth/Storage simulés et sans accès réseau. Les régressions d’invitations après retrait/rétrogradation et de corps HTTP non bornés ont été observées rouges puis vertes après correction. Le script SQL crée des comptes fictifs, teste autorisations/limites et finit par `ROLLBACK` ; le lancer uniquement sur une base locale jetable avec arrêt sur erreur. Il ne remplace pas un test de concurrence avec deux connexions ni un parcours navigateur authentifié déployé. Vérifier aussi les conseillers Supabase et les grants après application autorisée de la migration.
