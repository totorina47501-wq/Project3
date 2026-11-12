# Déployer MentionCheck sur Cloudflare (sans serveur dédié)

**Objectif :** utiliser votre compte Cloudflare existant pour héberger le site et les API Next.js.  
**Statut :** configuration préparée, aucun compte ni déploiement externe créé automatiquement.

## Stack minimale

| Service | Usage | Étape |
|---|---|---|
| Cloudflare Workers | Site Next.js / API / HTTPS | Déjà accessible dans votre compte Cloudflare, connexion nécessaire |
| Cloudflare Rate Limiting | Limitation des appels API | Bindings configurés dans wrangler.jsonc |
| Cloudflare KV | Cache image/IA non critique | À créer uniquement avant de brancher le moteur IA |
| Supabase | Postgres, Auth, RLS, Storage privé, pgvector | **Compte/projet requis**, pas un serveur à administrer |
| OpenAI | Texte, vision, transcription, embeddings | Clé requise pour activer l'IA |
| Stripe | Plans payants | Compte requis uniquement avant la vente |
| Resend | Emails transactionnels | Compte et domaine vérifié requis avant la vente |

Les quotas mensuels **sont transactionnels et stockés dans Supabase**, jamais exclusivement dans KV. Le rate limiting Cloudflare est approximatif par datacenter et vient en complément.

Cloudflare D1 utilise SQLite. Remplacer Supabase par D1 maintenant demanderait de réécrire les migrations, Auth, RLS et pgvector. Ce n'est pas retenu.

## 1. Local : installer la base de code

Préparer Node.js 22 ou 24 et npm. Depuis le dépôt :

```bash
git checkout feat/mentioncheck-bloc-1-fondations
npm install
npm run typecheck
npm run build
```

**Important :** le manifest contient des versions exactes mais aucun `package-lock.json` validé à cette étape. `npm install` est nécessaire avant `npm ci`.

## 2. Connexion Cloudflare

Ouvrir https://dash.cloudflare.com/ et confirmer que Workers & Pages est activé.

```bash
npx wrangler login
npm run cf:whoami
```

La commande d'authentification ouvre une fenêtre navigateur : **elle doit être effectuée depuis votre session Cloudflare**. Ne partagez pas de mot de passe ni de jeton API dans un ticket GitHub.

## 3. Aperçu avant mise en ligne

```bash
npm run preview:cloudflare
```

Cette commande fabrique le bundle Worker puis l'exécute localement dans Wrangler. Si les dépendances Workers sont incompatibles, corriger le build avant tout déploiement.

## 4. Déployer le site (une fois le build validé)

```bash
npm run deploy:cloudflare
```

Par défaut, Cloudflare fournit une adresse `*.workers.dev`. Aucun DNS de `mentioncheck.fr` n'est changé par ce dépôt.

Quand le site fonctionne, dans Cloudflare Workers > mentioncheck > Settings > Domains & Routes, ajouter le domaine personnalisé et laisser Cloudflare gérer le HTTPS.

## 5. Base de données Supabase (un service externe, sans serveur à louer)

Créer un projet sur https://supabase.com/dashboard en choisissant une région européenne. Enregistrer séparément :
- Project URL publique
- clé publishable / anon publique
- clé `service_role` **privée et serveur uniquement**

Appliquer les migrations depuis `supabase/migrations` et le seed selon `docs/02-database.md`, puis lancer le test SQL `tests/sql/security_smoke.sql`.

Ne pas déployer les fonctionnalités privées avant que les migrations et les tests RLS passent sur l'instance cible.

## 6. Brancher l'IA plus tard

La configuration d'environnement est documentée dans `.env.example`. Les clés personnelles ne sont jamais commitées. Pour les secrets serveur Cloudflare :

```bash
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put SUPABASE_SERVICE_KEY
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put RESEND_API_KEY
```

Ne lancer ces commandes que lorsque chaque compte correspondant existe. Le CLI demandera d'entrer le secret dans un prompt local. Les variables `NEXT_PUBLIC_*` doivent être ajoutées comme variables de build et d'exécution adaptées.

## 7. Cache IA (option à activer au bloc 3)

Créer une namespace KV :

```bash
npx wrangler kv namespace create MENTIONCHECK_AI_CACHE
```

Inscrire l'ID réel dans `wrangler.jsonc`, sous `kv_namespaces`, avec le binding `AI_CACHE`. Ne pas inventer cet ID : il dépend du compte. Configurer le cache avec TTL de 30 jours uniquement pour les données appropriées ; pas de token ni de donnée non pseudonymisée en cache global.

## 8. Vidéo : contraintes Cloudflare Workers

FFmpeg natif n'est pas exécuté dans le Worker Next.js. Les analyses vidéo sont planifiées pour un traitement isolé, par exemple Cloudflare Queues et Containers (selon éligibilité/plan), avec extraction des 3 images et transcription. Tant que ce worker n'existe pas, **ne pas prétendre que la vidéo est fonctionnelle**.

## 9. Déploiement GitHub automatique

Après que les secrets existent et que les tests passent, connecter `totorina47501-wq/Project3` dans **Cloudflare Workers Builds** ; configurer la branche de production `main`, la commande de build et les variables Cloudflare. Ne pas ajouter de secrets aux fichiers Git.

Le domaine `mentioncheck.fr` est un objectif de marque, **pas un nom de domaine dont la possession est vérifiée**.

### Sources et références

- https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/
- https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
- https://developers.cloudflare.com/workers/databases/connecting-to-databases/

## Dépannage — build « could not determine executable »

Le dépôt GitHub avait initialement seulement un README sur `main`. Les dépendances `@opennextjs/cloudflare` sont sur `feat/mentioncheck-bloc-1-fondations`. Dans Cloudflare Workers > projet > Settings > Build > Branch control, sélectionner cette branche puis relancer le build.

Le build Cloudflare du 3 novembre 2026 a confirmé que le Worker réel est `mentioncheck`, publié sur `https://mentioncheck.toto-rina47501.workers.dev`. `wrangler.jsonc` utilise donc `name: mentioncheck`, en cohérence avec le nom attendu par Cloudflare Workers Builds. La mention `project3` provenait du formulaire initial.

Commandes recommandées dans Workers Builds :

```sh
# Build command
npx @opennextjs/cloudflare build
# Deploy command
npx @opennextjs/cloudflare deploy
# Preview command
npx wrangler preview
```

Depuis Deployments > View Build History, menu `...` du build en échec > Retry build. Les opérations de base Supabase ne sont pas nécessaires pour afficher la landing initiale.

## Confirmation de publication du 3 novembre 2026

Le journal transmis indique : compilation Next.js réussie, bundle OpenNext créé, 26 assets téléversés, déploiement du Worker `mentioncheck` terminé sur `https://mentioncheck.toto-rina47501.workers.dev`. Les flags `workers_dev` et `preview_urls` sont explicités en configuration pour éviter les avertissements par défaut.

La compilation publiée correspond à une **page d'accueil de fondation**, pas au SaaS complet. Aucune route métier, connexion Supabase ou moteur IA n'est encore validée.

### Cache des dépendances Bun

Cloudflare résout bien les 856 dépendances, mais n'enregistre pas de cache tant que le dépôt ne possède ni `bun.lock` ni `package-lock.json`. Lors d'une installation sur un environnement autorisant l'accès au registre npm, générer et versionner un lockfile (`npm install --package-lock-only` ou `bun install`) puis faire valider le build en CI. Ne jamais ajouter un lockfile fabriqué sans résolution réelle du graphe de dépendances.


## Diagnostic connexion — 3 novembre 2026

Un échec POST /api/auth/login renvoyant HTTP 503 était masqué par un
message générique. Le journal Cloudflare indiquait seulement le niveau error.
Un diagnostic minimal a été ajouté, filtrable sous :

`[mentioncheck][auth_login_failure]`

Les catégories sont : `missing_runtime_config`, `invalid_credentials`,
`rate_limited`, `provider_unavailable`, `configuration_error`, `unknown`.
Les journaux affichent au maximum les NOMS des variables absentes ou deux
indicateurs booléens. Aucune valeur, aucun mot de passe, email, cookie ou jeton
ne doit être journalisé.

Dans Cloudflare, ouvrir Workers & Pages > mentioncheck > Settings >
Variables and Secrets. Vérifier que `NEXT_PUBLIC_SUPABASE_URL` et
`NEXT_PUBLIC_SUPABASE_ANON_KEY` existent AUSSI au runtime.
Renseigner les variables publiques en Build pour leur injection dans les pages
Next.js. Ensuite sauvegarder, redéployer, retester une seule connexion puis
contrôler Observability > Logs.

Une compilation CI verte ne prouve pas que les variables de production sont
configurées.

## Prévention des variables supprimées par les déploiements (novembre 2026)

**Cause diagnostiquée :** Wrangler remplace les variables Text configurées depuis
le Dashboard si elles ne sont pas déclarées dans la configuration, lors d'un
déploiement. Les secrets chiffrés sont conservés par défaut. Le projet utilise
Cloudflare Workers Builds + OpenNext ; il est donc important de préserver les
variables Runtime ajoutées depuis le tableau de bord.

**Correction dans le dépôt :** `"keep_vars": true` au niveau racine de
`wrangler.jsonc`. Le script npm `deploy:cloudflare` passe aussi
`-- --keep-vars` à Wrangler via OpenNext.

**Commande de déploiement à configurer dans Cloudflare Workers Builds :**

```sh
npx @opennextjs/cloudflare deploy -- --keep-vars
```

Conserver comme commande de build : `npx @opennextjs/cloudflare build`.
La commande de preview peut rester `npx wrangler preview`.

**Important :** le flag préserve les variables existantes, il ne les recrée
pas. Il faut d'abord restaurer dans Workers > mentioncheck > Settings >
Variables and Secrets (Production) :
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Text),
`SUPABASE_SERVICE_KEY`, `OPENAI_API_KEY` (Secret).

Pour Next.js, les deux `NEXT_PUBLIC_` doivent aussi exister dans
Settings > Builds > Build variables and secrets pour l'injection au build.
Les variables de build et les variables d'exécution sont distinctes.
NE JAMAIS copier la valeur d'une clé secrète dans `wrangler.jsonc`
ou dans GitHub. La clé OpenAI exposée précédemment doit rester révoquée.

**Validation :** vérifier après un nouveau déploiement que les deux variables
Text restent présentes en Production et que la connexion fonctionne. Cette
validation réelle Cloudflare est distincte du test CI.

## Domaine acquis : `mentioncheck.app` — préparation contrôlée (11 novembre 2026)

Domaine principal souhaité : **https://mentioncheck.app**, sur le Worker existant `mentioncheck` (pas de second Worker ni de second projet). Le `wrangler.jsonc` contient désormais le routage Cloudflare **Custom Domain** pour `mentioncheck.app` et `NEXT_PUBLIC_APP_URL=https://mentioncheck.app`. Le sous-domaine `workers.dev` reste disponible comme filet de sécurité ; **aucune modification du Worker `mentioncheck-staging`** et aucun changement de secrets.

**État : PR de préparation, pas preuve d'activation distante.** Avant fusion/déploiement :

1. Dans Cloudflare, vérifier que la zone `mentioncheck.app` est **Active** dans le **même compte** que Workers & Pages > `mentioncheck`. Si le registrar est externe, utiliser exactement les nameservers attribués par Cloudflare (pas des valeurs inventées). Si le domaine est acheté via Cloudflare Registrar, cette étape est normalement déjà gérée.
2. Dans Workers & Pages > `mentioncheck` > Settings > Domains & Routes, confirmer l'absence de configuration préexistante du même hostname et le bon Worker. Laisser **Custom Domain** créer automatiquement le DNS / HTTPS ; ne pas ajouter un CNAME concurrent. Si une configuration existe déjà, vérifier et réutiliser l'existant plutôt que dupliquer.
3. Dans Workers Builds, configurer **aussi en Build variables** `NEXT_PUBLIC_APP_URL=https://mentioncheck.app`. Le `wrangler.jsonc` définit sa valeur **runtime** ; cela ne garantit pas l'URL incluse dans le bundle Next.js généré au build. Conserver les variables Supabase publiques déjà en place, sans exposer les secrets.
4. Dans Supabase **production** > Authentication > URL Configuration, ajouter `https://mentioncheck.app` comme Site URL / URL de redirection adéquate. Conserver temporairement l'ancien hostname en allowlist si des confirmations d'email ou sessions en dépendent. Ne pas toucher à Supabase staging. Contrôler confirmation d'email, reset, login, cookies et refus inter-origines.
5. Quand la zone, le certificat SSL et la revue sont validés, fusionner la PR après CI verte et contrôle de sécurité, puis vérifier **les réponses HTTP réelles** de `https://mentioncheck.app/`, `/login`, `/robots.txt` et `/sitemap.xml` et le **SHA effectivement publié**. Le build vert seul n'est pas une preuve du domaine actif.
6. Pour `www.mentioncheck.app`, définir **après activation** une règle Cloudflare Redirect 301 vers l'apex, en conservant le chemin ; ne pas créer deux origines canoniques.

**Garde-fous** : le domaine ne vaut pas lancement commercial. Les flags `BILLING_ENABLED=false`, `STRIPE_WEBHOOK_ENABLED=false` et `STRIPE_LIVE_APPROVED=false` restent inchangés, et `release:evidence-required` / issue #16 restent ouverts. Le garde-fou Stripe Live dans `lib/billing/config.ts` exige encore l'ancien hostname : son changement exige une revue distincte dans la PR Stripe #131, **jamais une activation automatique des paiements**. Ne déclencher aucun appel IA payant ni réinitialisation d'utilisateurs pour la recette DNS.
