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

Le dépôt GitHub a initialement seulement un README sur `main`. Les dépendances `@opennextjs/cloudflare` sont sur `feat/mentioncheck-bloc-1-fondations`. Dans Cloudflare Workers > projet > Settings > Build > Branch control, sélectionner cette branche puis relancer le build.

Le Worker Cloudflare visible dans la capture s'appelle `project3`, aussi le `name` dans `wrangler.jsonc` correspond désormais à `project3`. Si le Worker a été renommé après la capture, les noms doivent être à nouveau alignés.

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
