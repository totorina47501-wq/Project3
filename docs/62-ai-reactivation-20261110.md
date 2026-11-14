# MentionCheck — réactivation IA payante contrôlée
**État au 14 novembre 2026 : activation texte et vision autorisée par l'exploitant et proposée dans le code de production ; propagation réelle Cloudflare et fonctionnement modèle non encore attestés.**

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
