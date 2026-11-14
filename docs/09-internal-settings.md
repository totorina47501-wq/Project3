# Paramètres internes et modèles d’emails

## TikTok — préparation staging demandée le 13 novembre

La demande explicite de l'exploitant étend le périmètre YouTube. Réutiliser le
ticket #124 et la branche sociale existante ; #132 étant déjà fusionnée, la
suite TikTok nécessite sa propre PR de revue, sans recréer routes ou migrations.
Le code accepte TikTok uniquement sur l'origine staging exacte, avec les deux
flags actifs et les secrets serveur présents. Le fichier Wrangler et la
production restent fermés. Le parseur utilise la réponse OAuth v2 à la racine.

Configuration opérateur nécessaire :
- Régénérer le secret exposé dans la capture ; ne pas le réutiliser ni le publier.
- Dans TikTok **Sandbox**, ajouter Login Kit / Web, permission `user.info.basic`
  et un compte de test autorisé ; aucun scope de publication ou import vidéo.
- Redirect URI exacte :
  `https://mentioncheck-staging.toto-rina47501.workers.dev/api/social-accounts/oauth/callback/tiktok`.
- Dans les secrets du Worker **mentioncheck-staging** uniquement, renseigner les
  identifiants de cette Sandbox : `SOCIAL_OAUTH_TIKTOK_CLIENT_KEY` et
  `SOCIAL_OAUTH_TIKTOK_CLIENT_SECRET`. Ne pas copier un secret production dans staging.
- N'activer `SOCIAL_OAUTH_TIKTOK_ENABLED` qu'après déploiement du candidat et
  confirmation de la configuration fournisseur. `SOCIAL_OAUTH_ENABLED` existe déjà.

Les tests hors ligne ne prouvent pas le consentement TikTok, la persistance
réelle ni sa révocation. Renouvellement automatique non implémenté : reconnexion
à expiration. Aucun TikTok opérationnel ou validé en production n'est revendiqué.
Références : [Login Kit Web](https://developers.tiktok.com/docs/en/login-kit-web),
[échange OAuth v2](https://developers.tiktok.com/docs/en/oauth-get-a-user-access-token).

## État vérifié le 13 novembre 2026

Sur le staging du candidat `f507054987dc7ba0bb990e5d839040810392d426`
(Cloudflare `96a9d4d0-13e9-4d59-8b6f-c896dc895e3d`), le parcours Google réel
a confirmé connexion avec chaîne, persistance serveur Vault, reconnexions sans
doublon, déconnexion avec révocation confirmée par le handler et refus de
consentement. Après le refus : zéro connexion active, zéro référence de jeton,
zéro secret YouTube ; une fiche déconnectée conservée. Aucun secret extrait.
Les trois migrations OAuth sont installées en staging, aucune en production.
La [CI du candidat](https://github.com/totorina47501-wq/Project3/actions/runs/43398535618)
est SUCCESS. Les preuves détaillées sont dans le
[commentaire existant de #16](https://github.com/totorina47501-wq/Project3/issues/16#issuecomment-6839768857).

Production OAuth reste désactivé. Google présente l'application comme étant en
test/non validée et le consentement observé ne contient pas les liens vers les
conditions et la confidentialité. L'expiration réelle n'a pas été attendue ;
le code exige une reconnexion, sans renouvellement automatique, et retient la
première chaîne retournée. Ces limites ne constituent pas une certification
publique complète. Les sections historiques ci-dessous décrivent aussi des
états antérieurs ; cette entrée prévaut pour les preuves opérationnelles.

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

## Connexions OAuth sociales — code présent, activation bloquée

Les routes serveur réalisent le démarrage, le callback, l’échange adapté au
fournisseur, l’écriture du secret dans Vault, l’expiration et la déconnexion.
Le parcours manuel reste indépendant. Au premier affichage, tous les réseaux
indiquent « Connexion indisponible » ; le bouton « Connecter » apparaît seulement
si le garde-fou global **et** le drapeau du réseau sont `true` et que ses
identifiants serveur, l’origine HTTPS et l’allowlist concordent. Ne pas activer
ces variables avant la recette isolée et les validations externes ci-dessous.

Variables globales : `SOCIAL_OAUTH_ENABLED`, `SOCIAL_OAUTH_PUBLIC_ORIGIN` et
`SOCIAL_OAUTH_ALLOWED_ORIGINS`. L’origine publique doit être une origine HTTPS
exacte, également présente dans l’allowlist. Chaque réseau a son propre
interrupteur et ses identifiants :

| Réseau | Interrupteur | Identifiant / secret serveur |
|---|---|---|
| Instagram | `SOCIAL_OAUTH_INSTAGRAM_ENABLED` | `SOCIAL_OAUTH_INSTAGRAM_CLIENT_ID` / `SOCIAL_OAUTH_INSTAGRAM_CLIENT_SECRET` |
| TikTok | `SOCIAL_OAUTH_TIKTOK_ENABLED` | `SOCIAL_OAUTH_TIKTOK_CLIENT_KEY` / `SOCIAL_OAUTH_TIKTOK_CLIENT_SECRET` |
| YouTube | `SOCIAL_OAUTH_YOUTUBE_ENABLED` | `SOCIAL_OAUTH_YOUTUBE_CLIENT_ID` / `SOCIAL_OAUTH_YOUTUBE_CLIENT_SECRET` |
| LinkedIn | `SOCIAL_OAUTH_LINKEDIN_ENABLED` | `SOCIAL_OAUTH_LINKEDIN_CLIENT_ID` / `SOCIAL_OAUTH_LINKEDIN_CLIENT_SECRET` |
| Facebook Pages | `SOCIAL_OAUTH_FACEBOOK_ENABLED` | `SOCIAL_OAUTH_FACEBOOK_CLIENT_ID` / `SOCIAL_OAUTH_FACEBOOK_CLIENT_SECRET` |

Ne pas placer les identifiants ou jetons dans le navigateur, une URL, un journal,
`.env.example` ou le dépôt. Les migrations initiales
`20261110210000_social_oauth_transactions.sql` et
`20261110220000_social_oauth_vault_accounts.sql` sont déjà appliquées sur le
staging Supabase ; ne pas les rejouer sous leurs versions locales. La migration
corrective `20261112072300_social_oauth_expiry_actor.sql` vérifie l’acteur nul
sans retirer l’expiration du propriétaire ou du rôle serveur ; elle reste à
revoir avant toute application distante.

Le démarrage est un POST same-origin. Le `state` aléatoire est lié au propriétaire
et au `session_id` de la session Supabase validée, seul son SHA-256 est stocké,
sa durée est de 10 minutes et le RPC le consomme atomiquement une fois. Le
serveur limite à cinq les états non consommés d’une même session/fournisseur et
supprime les expirés au prochain démarrage. Le vérificateur PKCE est conservé
côté serveur pour Google/YouTube (S256). Le callback
est exclusivement
`https://<origine-HTTPS-allowlistée>/api/social-accounts/oauth/callback/<réseau>`.
Origine, chemin, paramètres, doublons, erreurs, expiration, session, propriétaire
et rejeu sont contrôlés. Les erreurs/redirections ne renvoient jamais le jeton,
le code OAuth ou les messages privés d’un fournisseur.

Les jetons d’accès sont stockés sous forme de secret Vault et seul leur UUID est
conservé sur `social_accounts`; ni `anon` ni `authenticated` ne peuvent lire ce
secret ou les dates d’expiration. Aucun jeton de renouvellement n’est demandé ou
stocké : à expiration, le secret Vault est supprimé au prochain chargement des
comptes, l’état devient `expired` et l’utilisateur doit reconnecter. La
déconnexion supprime localement le secret et marque la ligne `expired`.
TikTok/Google ont un appel de révocation serveur ; pour Instagram/LinkedIn ou
lorsque l’appel distant échoue, l’interface indique que la révocation fournisseur
reste à vérifier dans les paramètres de l’application concernée.

| Réseau | Adaptateur et permissions minimales implémentés | État externe |
|---|---|---|
| Instagram / Meta | Instagram Login ; `instagram_business_basic` (séparateur conforme Meta), échange de code sur `api.instagram.com/oauth/access_token`, identifiant de compte renvoyé par le jeton. Le jeton court est traité comme valide 1 h ; aucun échange vers un jeton long ni scope de publication. | **BLOCKED** — compte Business/Creator, app Meta Business, callback enregistré, App Review/permissions et procédure de révocation à confirmer. |
| TikTok | Login Kit Web ; `user.info.basic`, échange sur `/v2/oauth/token/`, validation de ce scope dans la réponse token avant persistance, identifiant `open_id`, révocation sur `/v2/oauth/revoke/` avec client key, secret et token en corps form-urlencoded. Pas de contenu de profil collecté. | **BLOCKED** — produit Login Kit et app approuvés, callback enregistré ; confirmer la recette de révocation de l’app. |
| YouTube / Google | OAuth web ; `youtube.readonly`, PKCE S256, `channels.list` (`part=id`, `mine=true`, identifiant de chaîne uniquement) et révocation Google. | **BLOCKED** — projet, API/quota, écran de consentement et vérification Google selon les utilisateurs/scopes. |
| LinkedIn | OIDC ; `openid profile`, échange de code puis endpoint `userinfo`; aucun email. | **BLOCKED** — produit « Sign In with LinkedIn using OpenID Connect », app/callback approuvés et procédure de révocation à confirmer. |
| Facebook Pages | Facebook Login, échange du code sur le serveur, contrôle de `pages_show_list` via `/me/permissions`, puis liste bornée à 20 des Pages gérées par `/me/accounts` (`id`, `name`, jeton Page seulement en mémoire serveur). L’utilisateur choisit explicitement les Pages. Aucun profil Facebook seul, contenu, messages ou publication. Disponible uniquement avec flags/secrets et origine staging exacte. | **BLOCKED** — App Meta, utilisateurs de test, callback, permission/App Review et Business Verification/Advanced Access à vérifier ; aucune activation production ni E2E fournisseur attestés. |

Documentation officielle : [Instagram Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/),
[Meta Pages API — gérer et lister les Pages](https://developers.facebook.com/documentation/pages-api/manage-pages/),
[permissions Meta et pages_show_list](https://developers.facebook.com/documentation/development/permissions/),
[demander/vérifier/révoquer les permissions Facebook Login](https://developers.facebook.com/documentation/facebook-login/guides/permissions/request-revoke/),
[durée et protection des jetons Meta](https://developers.facebook.com/documentation/facebook-login/guides/access-tokens/),
[TikTok Login Kit Web](https://developers.tiktok.com/doc/login-kit-web/),
[TikTok token revocation](https://developers.tiktok.com/docs/en/oauth-revoke-a-user-access-token),
[Google OAuth web server](https://developers.google.com/identity/protocols/oauth2/web-server),
[YouTube channels.list](https://developers.google.com/youtube/v3/docs/channels/list),
[Google token revocation](https://developers.google.com/identity/protocols/oauth2/web-server#tokenrevoke),
[LinkedIn OIDC](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2).

### Facebook Pages — portée et révocation

Facebook est distinct de l’adaptateur Instagram et reste fermé hors de
`https://mentioncheck-staging.toto-rina47501.workers.dev`. Callback staging :
`https://mentioncheck-staging.toto-rina47501.workers.dev/api/social-accounts/oauth/callback/facebook`.
La permission demandée est uniquement `pages_show_list` ; aucun `pages_read_engagement`,
permission de messages ou permission de publication n’est ajoutée. Meta peut
demander App Review et Business Verification/Advanced Access avant l’usage hors
des rôles de test.

Après le retour OAuth, le serveur échange le code, vérifie la permission accordée,
puis conserve temporairement dans Vault les jetons nécessaires à la sélection.
Le navigateur reçoit uniquement les noms et identifiants bornés des Pages, jamais
un jeton. La sélection est liée à la session, expire après dix minutes, contrôle
que chaque identifiant provient de la liste serveur, déduplique les Pages et
persiste leurs jetons en Vault dans une transaction qui applique le quota existant.
Une tâche `pg_cron` supprime les secrets et sélections expirés toutes les cinq
minutes ; `pg_cron` doit être activé avant d’appliquer la migration. Les accès
aux routes suppriment aussi immédiatement une sélection expirée. Le harnais
PGlite simule l’enregistrement de cette tâche, pas l’ordonnanceur Supabase réel.
L’expiration conservatrice suit celle du jeton utilisateur ; aucun renouvellement
automatique n’est revendiqué. « Actualiser la liste » revalide les Pages pendant
la sélection ; pour en ajouter plus tard, relancer la connexion et sélectionner
les nouvelles Pages.

Meta documente `DELETE /{user-id}/permissions` comme une révocation complète de
l’autorisation de l’application, qui invalide les jetons utilisateur associés.
Une déconnexion Facebook enlève donc toutes les Pages Facebook locales de cette
application, pas seulement la ligne cliquée : une confirmation est demandée puis
toutes les références Vault Facebook du propriétaire sont supprimées. Si l’appel
Meta échoue ou si l’intégration n’est pas configurée, les Pages sont tout de même
désactivées localement et le résultat indique que la révocation distante n’est
pas confirmée ; il ne prétend pas avoir révoqué l’autorisation Meta. Avant le
nettoyage Vault, le serveur tente la révocation une fois pour chaque jeton
utilisateur distinct parmi les Pages enregistrées et les sélections en attente.

Les handles OAuth affichés sont les identifiants techniques stables renvoyés par
les fournisseurs, pas des noms d’utilisateur vérifiés. Scopes et endpoints sont
des demandes, pas une preuve d’autorisation ou d’App Review. Le PKCE Web n’est
pas documenté dans les guides Login Kit Web TikTok ni OIDC LinkedIn cités
(LinkedIn le documente pour son client natif) ; l’adaptateur ne l’active donc pas
pour ces clients confidentiels. Les adaptateurs LinkedIn/Instagram ne disposent pas ici d’un appel
programmatique de révocation. Aucune lecture de publications, message privé,
scraping, import média ou publication n’est implémenté.

| Validation | Résultat |
|---|---|
| Échange simulé hors ligne, state/PKCE/callback/anti-replay, contrôles d’accès et tests SQL locaux | **PASS** (suite locale seulement ; le stub SQL ne teste pas le chiffrement Vault natif). |
| Expiration OAuth : acteur nul refusé, autre propriétaire refusé, propriétaire et service_role autorisés | **PASS** local après migration corrective ; application staging en attente de revue. |
| Identifiants/app review/callbacks et permissions des quatre plateformes | **BLOCKED** (non fournis/non vérifiés). |
| E2E staging avec comptes jetables | **BLOCKED** (des tentatives antérieures n’ont pas persisté de compte OAuth ; le parcours complet après le dernier correctif reste à prouver). |
| Activation en production, migration distante et recette de production | **BLOCKED** (non effectuées et interdites par ce lot). |

Avant une activation ultérieure, il faut activer `pg_cron` dans la base de test
autorisée, créer les applications développeur,
enregistrer les URI de callback exactes, obtenir les revues/scopes requis, valider
les méthodes de révocation et renseigner uniquement les secrets du serveur de
l’environnement isolé. Puis faire une revue humaine Auth/RLS/Vault, appliquer
la migration uniquement à la base de test autorisée et réaliser l’E2E avec des
comptes jetables et leur consentement explicite. Aucun de ces points n’est
prouvé par la suite hors ligne ou une CI verte.

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

## Livraison YouTube seule — 13 novembre 2026

La configuration serveur refuse Instagram, TikTok et LinkedIn même si leurs variables sont activées. Les déclarations manuelles restent disponibles. Les flags OAuth production sont explicitement fermés dans Wrangler ; YouTube ne doit être ouvert qu'après preuve fournisseur avec une chaîne et persistance Vault vérifiée. Le cas sans chaîne reste géré par le code existant.

Limites observées : l'échange conserve un access token temporaire, sans renouvellement automatique ; une reconnexion est nécessaire après expiration. La récupération retient la première chaîne renvoyée, sans inventaire multi-chaînes. E2E fournisseur et activation production BLOCKED sans compte autorisé avec chaîne.

Validation locale du correctif : 493 tests unitaires, 15 suites SQL, TypeScript, lint et registre anti-doublons réussis. Playwright tenté : 34 échecs liés au lancement Chromium (`socket() failed: Operation not permitted`), 6 réussites, 5 ignorés ; aucun PASS navigateur local revendiqué. Les quatre tests Analytics production échouent au même lancement, sans atteindre les assertions. La CI distante doit être contrôlée au nouveau SHA.

### Réconciliation avec la certification #128 — 13 novembre

Les branches aux SHAs `b8bf010` (#128) et `6915314` (#132) ont chacune une CI complète SUCCESS (runs 43334929844 et 43335085078), y compris Playwright/SQL/RLS/Next/OpenNext. Les échecs Chromium locaux ne bloquent donc plus ces preuves CI. Cette branche intègre ensuite #128 en conservant le bridge Solo, les preuves PRA/RGPD, le groupe staging `queue: max`, la fermeture IA et les déclarations manuelles. La CI du nouveau commit combiné reste à vérifier séparément. Aucune migration production ni activation OAuth/paiement n'est incluse.

## Reprise sans navigateur — 14 novembre 2026

Réutiliser le workflow `mentioncheck-cloudflare-readonly-diagnostic.yml` et son
script existant sur la branche de #141. Il inspecte uniquement les noms de
secrets OAuth staging, les flags booléens autorisés et la concordance stricte
des origines. Aucun déploiement ni valeur secrète dans les sorties. Les secrets
Cloudflare restent dans GitHub Actions. Une présence ne prouve ni validité ni
rotation d'un secret TikTok. Production : job `inspect` existant relançable seul.
Copilot a indiqué un échec de signature GPG pour publier Facebook : aucun code
Facebook au HEAD 6ff0889 malgré la fin de session. Ne pas contourner la signature.
