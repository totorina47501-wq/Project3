# MentionCheck — réactivation IA payante contrôlée
**État au 14 novembre 2026 : activation texte et vision autorisée par l'exploitant et proposée dans le code de production ; propagation réelle Cloudflare et fonctionnement modèle non encore attestés.**

### Recette IA texte autonome sans TinyFish — un seul appel (14/11/2026)

Le navigateur TinyFish ne dispose pas d'une session authentifiée, et son quota est épuisé. Le compte technique historique a été désactivé le 5 novembre. Ne réactiver **aucun compte existant**.

Le lot `scripts/recette/production-ai-single-e2e.mjs` et le workflow `mentioncheck-ai-production-single-qa.yml` préparent une recette de bout en bout au travers des **routes existantes** `/api/auth/register`, `/api/auth/login` et `/api/check`. La branche `main` est seule autorisée et le commit de fusion doit commencer par `ops(ai): run one-shot production text QA`.

1. Le runner GitHub crée un mot de passe fort avec `randomBytes` **uniquement en mémoire** et une adresse de recette unique de la forme `mentioncheckcorp+mcqa-…@gmail.com`. Le compte suit le flux d'inscription normal avec `Origin=https://mentioncheck.app`, sans admin API inventée, cookie emprunté ou contournement de l'authentification.
2. À l'émission du marqueur `QA_SIGNUP_ACCEPTED_CONFIRM_IN_SUPABASE`, l'opérateur technique confirme dans Supabase **la seule nouvelle adresse portant ce préfixe**, créée dans les 10 dernières minutes, après vérification stricte de cardinalité = 1. Cette confirmation par canal admin ne modifie aucun des comptes historiques ; `app_metadata.validation_fixture=true` est posé **uniquement** sur le nouveau compte.
3. Le runner se connecte avec son mot de passe éphémère, vérifie l'accès privé `/api/mia/conversations`, puis effectue **une seule** requête `POST /api/check`, `execution=ai`, légende entièrement fictive, sans média. Il collecte seulement `analysisMode`, validité du score, nombre d'alertes et de réécritures, sans journaux de données ou identifiants, et n'effectue **aucun retry OpenAI**.
4. L'opérateur lit en SQL uniquement les nouvelles métriques `ai_analyses` et `verifications` du compte `validation_fixture`, compare aux compteurs de référence, vérifie coût/quota et bannit le compte éphémère. **Ne pas supprimer ni modifier les deux comptes historiques**. Les identifiants du compte QA ne sont jamais enregistrés dans GitHub ni exposés dans les logs.
5. Si l'inscription, la confirmation, le cookie ou les contrôles échouent, le test s'arrête sans paiement et sans contourner le login. Aucun test image/Mia ou second appel n'est lancé dans ce lot.

**Coût et portée :** une analyse IA explicite est facturable par OpenAI ; le budget projet fournisseur de 25 USD/mois est une cible **non vérifiée**. Les scripts bornent à une seule analyse sur du contenu fictif mais n'imposent pas de hard cap monétaire. Pas de paiement Stripe, pas de droit d'abonnement forcé, pas de migration, pas de fournisseur navigateur supplémentaire. Conserver le coupe-circuit `OPENAI_PAUSED`.

### Exécution Cloudflare ciblée après fusion (14/11/2026)

La **PR de paramètres IA #155** a été fusionnée (commit `4e7948d9bb9f30be94a462a91e68f8d462ea2c8f`, CI verte), mais le diagnostic API Cloudflare lu après fusion affichait encore `OPENAI_PAUSED=true`, `OPENAI_TEXT_ENABLED=false`, `OPENAI_VISION_ENABLED=false`. Il a confirmé la **présence du nom** du secret `OPENAI_API_KEY`.

Pour corriger la non-propagation due à `keep_vars=true`, un lot opérateur dédié ajoute :
- `scripts/recette/production-ai-activate.mjs` : modification **exclusive** des trois indicateurs IA via PATCH des settings Cloudflare, avec lecture des versions, comparaison des bindings avant écriture, héritage des secrets et préservation du namespace Durable Object.
- `.github/workflows/mentioncheck-ai-production-activate.yml` : tentative de modification du Worker principal **uniquement** depuis la branche `main`, lors du commit opérateur explicite (ou relance `workflow_dispatch`), avec le secret Github Actions `MENTIONCHECK_PROD_CLOUDFLARE_API_TOKEN` si disponible. Aucun jeton de staging.
- Contrôle POST-PATCH des paramètres et GET `/api/health/ai` **sans appel payant** à OpenAI. Un HTTP 200 `configured` ne certifie pas le fonctionnement du modèle ; une réponse réelle d'un utilisateur authentifié reste nécessaire.
- Le script **refuse toute mutation** si Stripe, les fonctionnalités IA non autorisées ou la promotion Solo sont ouverts, si le Worker ou domaine diffère, si la clé OpenAI est absente, si la version déployée est incohérente ou si des bindings changent concurrentiellement.
- La permission Cloudflare GitHub Actions peut être en lecture seule ou absente : dans ce cas, la tentative doit échouer **sans altérer la production** et la connexion Cloudflare devra être rétablie. Conserver tous les logs sans secret.

**Important : le plafond budgétaire fournisseur OpenAI de 25 USD/mois n'a pas été consulté par ce workflow.** L'autorisation opérateur de fournir l'IA ne constitue pas une attestation de plafond. Ne pas annoncer de plafonnement garanti ni certifier le succès des réponses IA sans vérifications fournisseur et utilisateur.

### Activation décidée le 14/11/2026

- Dans `wrangler.jsonc` **Worker principal seulement** : `OPENAI_PAUSED=false`, `OPENAI_TEXT_ENABLED=true`, `OPENAI_VISION_ENABLED=true`.
- IA texte pour vérification explicite, réécriture et réponses Mia ; image en mode `detail: low`. Mia utilise la recherche juridique **lexicale** existante tant que les embeddings et la recherche vectorielle restent désactivés.
- `OPENAI_AUDIO_ENABLED=false`, `OPENAI_EMBEDDINGS_ENABLED=false`, `MEDIA_AI_ENABLED=false` : aucune réindexation, transcription, traitement automatique audio/vidéo ni activation du modèle embeddings.
- **Toutes les previews et le staging conservent** `OPENAI_PAUSED=true`, texte/vision désactivés. Les tests CI utilisent des mocks et aucun token fournisseur ; les appels réels restent réservés aux actions de l'utilisateur authentifié, soumises aux quotas SQL existants, au rate limiting et au max 2 500 tokens de sortie.
- **Stripe reste fermé** : `BILLING_ENABLED=false`, `STRIPE_WEBHOOK_ENABLED=false`, `STRIPE_LIVE_APPROVED=false`. Cette opération n'autorise aucun paiement ni activation des 30 jours Solo historiques.
- **Budget non garanti par le dépôt :** enveloppe pilote **25 USD par mois visée**, avec contrôle de limite de dépense et alerte 80 % dans le projet API OpenAI à confirmer dans la console fournisseur. Aucun accès de ce connecteur ne permet de lire ou fixer ce plafond. Les quotas par utilisateur ne remplacent PAS un plafonnement monétaire global.
- **Preuve à fournir après intégration :** vérification du dernier déploiement du Worker Cloudflare `mentioncheck` et de ses variables runtime (attention : `keep_vars=true` peut préserver des variables distantes anciennes). `GET /api/health/ai` peut confirmer la configuration et la présence de la clé sans consommer de crédits, mais **pas** sa validité ; ensuite **une seule analyse texte réelle** et une image légère, depuis un compte de test autorisé et avec limite fournisseur vérifiée, doivent prouver sortie, quota et facturation.
- **Coupe-circuit :** restaurer `OPENAI_PAUSED=true` dans le Worker en cas d'erreur fournisseur, d'absence de budget ou de dérive des dépenses. Aucun secret ni client réel n'est modifié par la PR.

**Le merge GitHub n'est pas un déploiement ni une preuve que l'IA est disponible sur `mentioncheck.app`.** Une approbation technique post-déploiement doit s'appuyer sur les résultats de la sonde et d'une requête modèle contrôlée.


Date : 10 novembre 2026. Projet GitHub : `totorina47501-wq/Project3`.

## Périmètre autorisé
- `OPENAI_PAUSED=false`, `OPENAI_TEXT_ENABLED=true` et
  `OPENAI_VISION_ENABLED=true` sur le **Worker production seulement**,
  pour l'analyse explicite d'une légende et d'une image, la réécriture
  et le chat Mia (texte) initiés par un utilisateur authentifié.
- `OPENAI_AUDIO_ENABLED=false`, `OPENAI_EMBEDDINGS_ENABLED=false`,
  `MEDIA_AI_ENABLED=false` : **aucune transcription de masse, aucun
  index RAG payant, aucune analyse média automatique**.
- `BILLING_ENABLED` et tous les secrets Stripe **inchangés**.
- Staging/Preview, CI et tests unitaires restent **zéro crédit IA**.
- Requête IA payante : l'utilisateur choisit `execution=ai` ;
  l'exécution par défaut `rules_only` reste gratuite.

## Préconditions avant de déclarer IA active
1. Confirmer **la présence uniquement**, pas la valeur, du secret
   `OPENAI_API_KEY` sur le Worker `mentioncheck`, distinct du staging.
   Ne jamais transférer une clé dans une PR ni en afficher l'empreinte.
2. Définir un **plafond strict de dépenses** dans le projet API OpenAI
   (par exemple 10 $ pour un premier cycle de recette), avec une alerte
   au seuil de 80 %. Activer explicitement **Enforce a hard limit**.
   Ce plafond est celui de la plateforme OpenAI et peut être dépassé
   légèrement, l'application ne prétend pas garantir une limite monétaire.
3. Vérifier un déploiement Cloudflare du SHA GitHub attendu sur le Worker
   de production, sans utiliser le token de staging pour le faire.
4. Depuis un compte test autorisé, effectuer **un seul** contrôle texte IA,
   vérifier un résultat `full`, une entrée `ai_analyses` et un quota
   réservé ; faire ensuite une vérification `rules_only` sans nouvelle
   entrée IA. Ne pas laisser tourner une boucle de test facturable.
5. Tester une image légère seulement après le succès texte, la facturation
   et la restitution de quota en cas d'échec. Le contrôle de données média
   et l'effacement restent des tâches RGPD séparées.

## Coupe-circuit
En cas de dépenses inattendues, erreurs 429/500 répétées, absence de
certitude sur la clé, ou incident sécurité : modifier le **Worker production**
en `OPENAI_PAUSED=true` puis redéployer. Les flags sont appliqués
en priorité avant chaque appel OpenAI dans `lib/openai/client.ts`.
`OPENAI_TEXT_ENABLED=false` et `OPENAI_VISION_ENABLED=false`
ferment individuellement chaque capacité. Aucun déploiement staging
ne doit modifier les variables du Worker de production.

## Limites connues et vérifications obligatoires
- Le dépôt ne peut **pas** lire les secrets Cloudflare de production, ni
  la facturation, ni la configuration d'application d'un plafond OpenAI.
  La présence de flags dans `wrangler.jsonc` n'est pas une preuve
  d'activation réelle sur les serveurs.
- Les comptes existants de production ont encore le profil historique
  `solo` : le correctif Gratuit 3/1/3 reste dans la PR #114 non
  fusionnée ; surveiller les quotas pendant la recette avant ouverture
  à de nouveaux utilisateurs. La distribution commerciale est bloquée.
- Le code ne déclenche pas d'appel d'IA durant la CI, et les tests
  utilisent des clés fictives. Les estimations internes `cost_usd`
  ne remplacent pas la facturation OpenAI.
- Une activation IA **ne vaut pas autorisation d'encaisser** : les
  formalités juridiques et Stripe live restent à terminer.


## Sonde HTTP sans appel facturable — 10 novembre 2026

`GET /api/health/ai` est un précontrôle non authentifié et peu coûteux.
Il ne lit que la **configuration du Worker** et vérifie le booléen composé
(clé non vide, texte activé et vision activée, absence de pause).
La réponse n'expose **ni secret**, ni numéro de projet, ni réglage exact,
ni identifiant d'utilisateur. Elle porte le marqueur
`ai-prod-20261110` pour permettre de vérifier si un build récent
est effectivement publié par Cloudflare Workers Builds. Les en-têtes
désactivent la mise en cache et l'indexation.

- HTTP 200 avec `status=configured` : configuration runtime cohérente ;
  **pas** une certification de la validité de la clé ou d'une réponse modèle.
- HTTP 503 avec `status=not_configured` : flags/clé insuffisants,
  pas de requête modèle.
- HTTP 404 : le Worker n'a pas encore déployé ce changement.
- Toute requête réellement facturable reste soumise à une session
  authentifiée, aux quotas, aux contrôles de sécurité, et au plafond
  de dépenses OpenAI Platform. La sonde ne déclenche jamais ces requêtes.
