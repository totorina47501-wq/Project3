# Paramètres internes et modèles d’emails

État du code : comptes sociaux déclarés manuellement, préférence de tonalité
persistée et quatre emails rendus localement. Aucun OAuth, envoi Resend ou appel
IA n’est déclenché par ces paramètres. La dépendance `resend` existait déjà ;
elle n’est ni importée ni initialisée par cette livraison.

## Comptes déclarés

La page `/dashboard/settings` affiche les métadonnées autorisées de
`social_accounts` : plateforme, nom, date et `connection_kind`.

- `manual` : déclaration créée dans MentionCheck, modifiable et retirable.
- `unknown` : ligne historique dont la connexion n’a pas été vérifiée, en lecture seule.
- `oauth` : valeur réservée à une intégration fournisseur future ; l’interface
  précise que l’état fournisseur n’est pas vérifié ici.

Aucune colonne Vault n’est sélectionnée, insérée, mise à jour ou retournée.
La suppression d’une déclaration retire seulement la ligne de métadonnées ;
elle ne touche aucun réseau social, média, archive ou jeton fournisseur.

`GET /api/social-accounts?page=1` lit les lignes du propriétaire par pages de 25.
`POST /api/social-accounts` crée une déclaration ; `PATCH` et `DELETE` sur
`/api/social-accounts/[id]` modifient/retirent une déclaration possédée.
Les objets JSON autorisent seulement `platform` et `handle`. Les noms sont
normalisés en minuscules sans `@`, bornés à 200 caractères et refusent les liens
ou espaces. Les corps sont limités à 2 048 octets, y compris sans Content-Length.

Les RPC `save_social_account` et `remove_social_account` vérifient `auth.uid()`
et le propriétaire, et verrouillent sa ligne `users` pendant la transaction.
Le quatrième compte Solo est refusé atomiquement, même avec deux créations
concurrentes. Le total comprend aussi les comptes historiques. Aucune limite
commerciale supplémentaire Pro/Studio n’est inventée et aucun formulaire ne
peut modifier le plan. Les écritures directes de `social_accounts` restent interdites.

## Socle OAuth social — préparé, désactivé

La déclaration manuelle ci-dessus reste l’unique parcours disponible. Il n’existe
ni route de démarrage/callback OAuth, ni bouton « connecter », ni échange de code
ou appel réseau aux fournisseurs. Les quatre métadonnées d’adaptateur et le
contrat serveur sont préparés pour tests hors ligne seulement.
`SOCIAL_OAUTH_ENABLED` doit être explicitement `true`, avec identifiants serveur,
origine HTTPS et allowlist d’origine concordants, avant que la configuration
puisse être considérée comme présente ; aucune de ces valeurs n’est livrée ou
activée ici.
Les variables globales prévues sont `SOCIAL_OAUTH_PUBLIC_ORIGIN` et
`SOCIAL_OAUTH_ALLOWED_ORIGINS`. Chaque fournisseur requiert en plus son propre
identifiant et secret serveur : `SOCIAL_OAUTH_INSTAGRAM_CLIENT_ID` /
`SOCIAL_OAUTH_INSTAGRAM_CLIENT_SECRET`, `SOCIAL_OAUTH_TIKTOK_CLIENT_KEY` /
`SOCIAL_OAUTH_TIKTOK_CLIENT_SECRET`, `SOCIAL_OAUTH_YOUTUBE_CLIENT_ID` /
`SOCIAL_OAUTH_YOUTUBE_CLIENT_SECRET` ou `SOCIAL_OAUTH_LINKEDIN_CLIENT_ID` /
`SOCIAL_OAUTH_LINKEDIN_CLIENT_SECRET`. Ne pas placer ces valeurs dans le navigateur,
les URL, les journaux, `.env.example` ou le dépôt.

Les demandes de démarrage créent un `state` aléatoire lié au propriétaire et à
l’identifiant de session Supabase, ne stockent que son SHA-256, expirent après
10 minutes et consomment leur état atomiquement une seule fois. Le vérificateur
PKCE n’est présent que pour Google/YouTube dans cette préparation web et demeure
dans la table serveur non lisible par `anon`/`authenticated`. Callback attendu :
`https://<origine-HTTPS-allowlistée>/api/social-accounts/oauth/callback/<réseau>`.
Le parseur refuse les origines/chemins différents, paramètres inconnus/dupliqués,
code et erreur simultanés, sessions/propriétaires divergents, états expirés et
rejeux. Ces invariants sont testés avec un magasin mémoire ; la migration SQL
ajoute la consommation atomique et `tests/sql/social_oauth_security.sql` vérifie
les droits et l’isolation A/B en base locale jetable.

| Réseau | État / scopes minimaux proposés | Pré-requis restant |
|---|---|---|
| Instagram / Meta | **Préparé, indisponible** : Instagram Login (`instagram_business_basic`), comptes professionnels ; pas de scope de publication | App Meta de type Business, URL callback enregistrée, accès/revue Meta et confirmation de la procédure officielle de révocation |
| TikTok | **Préparé, indisponible** : Login Kit Web (`user.info.basic`) ; pas de scope de publication | Produit Login Kit approuvé, `client_key`/secret serveur, callback HTTPS enregistré et confirmation de PKCE/révocation pour le client web |
| YouTube / Google | **Préparé, indisponible** : OAuth web Google, `youtube.readonly` (scope de lecture assez large pour l’identité de chaîne) avec PKCE S256 ; aucun appel YouTube Data API | Projet Google, YouTube Data API/quota, écran de consentement et vérification Google selon les utilisateurs/scopes |
| LinkedIn | **Préparé, indisponible** : OAuth 3-legged / OIDC (`openid profile`), sans email ni permissions d’écriture | Produit « Sign In with LinkedIn using OpenID Connect », app et callback approuvés ; PKCE/révocation du client web à confirmer |

Références fournisseurs : [Instagram Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/),
[TikTok Login Kit Web](https://developers.tiktok.com/doc/login-kit-web/),
[Google OAuth web server](https://developers.google.com/identity/protocols/oauth2/web-server) /
[YouTube OAuth](https://developers.google.com/youtube/data/guides/auth/server-side-web-apps),
[LinkedIn OAuth 3-legged](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow) /
[LinkedIn OIDC](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2).
Les scopes proposés ne signifient ni autorisation ni revue accordée. Aucun accès
aux publications, messages privés, scraping ou publication n’est implémenté.

La table `social_oauth_transactions` ne contient aucun jeton fournisseur. Aucun
échange/renouvellement/révocation de jeton ni écriture Vault n’est implémenté ;
la colonne réservée `access_token_vault_id` reste inaccessible au navigateur.
L’activation reste **bloquée** jusqu’à l’intégration serveur de l’échange adapté,
au stockage/révocation/expiration des jetons via Vault, à la validation humaine
des permissions/callbacks par fournisseur, à une revue de sécurité et à des tests
avec simulateurs locaux. Avant tout démarrage ultérieur : créer les applications
développeur, faire enregistrer les quatre URI exactes de callback, obtenir les
revues/permissions requises et placer les identifiants/ secrets uniquement dans
les secrets serveur Cloudflare. Aucune migration n’a été appliquée à une base
distante.

## Tonalité

`user_preferences` conserve `user_id`, `rewrite_tone` et `updated_at`.
Les valeurs sont celles du moteur existant : `naturel`, `créatif`, `institutionnel`.
Les politiques RLS limitent chaque lecture/écriture au propriétaire ; le plan et
le consentement d’entraînement demeurent indépendants.

`GET` et `PUT /api/social-accounts/preferences` lisent/enregistrent
`{ "rewriteTone": "créatif" }`. Le moteur `runCheck` lit ce choix uniquement
avant la réécriture déjà autorisée par son flux et son quota existants. Il garde
`naturel` si la table manque, si la lecture échoue ou si la valeur est invalide.
Aucun nouvel appel IA n’est ajouté. Le parcours sans IA est inchangé.

Les routes exigent une session, une origine explicite identique pour chaque
mutation et renvoient `Cache-Control: private, no-store`, y compris en erreur.
Les erreurs SDK sont masquées par `publicError`.

## Emails locaux

`lib/email/templates.ts` expose `renderEmail` (union de paramètres typée) et
`emailPreviews`. Chaque rendu contient `subject`, `text` et `html` en français :

1. `welcome` : accueil et premier contrôle sans IA.
2. `report-ready` : rapport disponible dans l’espace privé, sans contenu personnel.
3. `quota-warning` : usage/limite/période, sans proposition de paiement actif.
4. `erasure-received` : accusé de demande, précisant qu’aucune suppression automatique n’a été lancée.

Les données HTML sont échappées, les identifiants et dates validés, les origines
limitées à HTTPS sans identifiants, chemin, paramètres ou fragment. Les liens
ciblent uniquement les routes internes fixes. Aucun destinataire ni fonction
d’envoi n’est défini. Ces modèles ne prouvent aucun envoi effectif.

Rendu reproductible sans réseau (Node 22.12+), depuis la racine du dépôt :

```sh
node --experimental-strip-types --input-type=module <<'JS'
import { mkdirSync, writeFileSync } from 'node:fs';
import { emailPreviews } from './lib/email/templates.ts';
const directory = '/tmp/mentioncheck-email-previews';
mkdirSync(directory, { recursive: true });
for (const { name, email } of emailPreviews('https://local.test')) {
  writeFileSync(`${directory}/${name}.html`, email.html);
  writeFileSync(`${directory}/${name}.txt`, email.text);
}
JS
```

## Validation et activation restante

Tests hors réseau : `internal-settings.test.ts`, `social-routes.test.ts`,
`social-oauth.test.ts`, `internal-settings-render.test.ts`, `rewrite-preferences.test.ts`,
`email-templates.test.ts`. Ils couvrent validation, CSRF, session, masquage
SDK, réponses privées, transmission de la tonalité au moteur et rendu réel des
composants/emails. Les fournisseurs IA sont remplacés uniquement aux frontières
des tests ; aucune requête SDK ne sort de la suite.

`tests/sql/settings_security.sql` est destiné à PostgreSQL local jetable après
les migrations : propriété croisée, quota Solo, doublons, retrait libérant une
place, comptes historiques intouchables, grants et RLS de préférences.
Le verrou du profil sérialise les mutations ; sa course concurrente doit aussi
être vérifiée par le harnais SQL local de livraison.

`tests/sql/social_oauth_security.sql` vérifie en base locale l’état à usage unique,
son expiration, le lien propriétaire/session et les refus d’accès directs. Cette
validation hors ligne ne prouve ni l’application distante de la migration, ni
l’accès aux applications développeur ou l’accord des permissions fournisseur.

La proposition initiale de schéma est remise au parent dans
`/tmp/mentioncheck-settings.sql` ; ce fichier temporaire n’est pas la migration
du dépôt. Le parent intègre la migration et le registre. Une migration intégrée
au code ne signifie pas qu’elle a été appliquée à une base distante.

Restent externes : autorisations et validation OAuth pour chaque réseau,
configuration de domaine/expéditeur Resend, choix des déclencheurs et obligations
d’information applicables avant tout envoi. Aucun de ces points n’empêche le
rendu local ni la gestion interne après application séparée de la migration.
