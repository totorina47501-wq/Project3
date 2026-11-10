# MentionCheck — Stripe Sandbox (préparation du 10 novembre 2026)

## État confirmé auprès de Stripe

Compte Stripe Sandbox `acct_1UZzebCZ5rRirUf6` en environnement **test uniquement**, avec trois produits et trois
prix mensuels EUR (`livemode=false`), créés et relus le 10 novembre 2026.
Ces prix sont inclusifs (`tax_behavior=inclusive`), à prix fixe (`licensed`) :

| Offre | Produit Stripe test | Tarif Stripe test | Prix final / mois |
| --- | --- | --- | --- |
| Solo | `prod_VbN0WeEqgJBwJE` | `price_1UaAGVCZ5rRirUf6Mwl2S9LU` | 9 € |
| Pro | `prod_VbN0w5tEVRcLt5` | `price_1UaAGXCZ5rRirUf6yL7FJqSD` | 19 € |
| Studio | `prod_VbN0LGW4NMPIFN` | `price_1UaAGZCZ5rRirUf63iKoncrM` | 49 € |

Portail de facturation de test : `bpc_1UaAH4CZ5rRirUf6Ff8pq5z3`.
Historique, mise à jour du moyen de paiement, changement d'offre et résiliation en fin
de période sont disponibles dans la configuration Stripe. Le portail n'ouvre pas
à lui seul le paiement dans l'application.

Les identifiants `price_` sont des références publiques NON secrètes ; **aucune clé**
`sk_test_`, `whsec_` ou donnée client ne doit figurer dans Git, les logs ou
les captures de preuve.

## TVA / identité juridique

L'exploitant indique prévoir le régime de **franchise en base de TVA en France**.
Cela ne constitue pas une preuve d'immatriculation ni une autorisation de facturer.
Aucune immatriculation fiscale n'a été créée auprès de Stripe. Les prix inclusifs
fixent le montant affiché, ils ne rendent pas TVA applicable.
Le checkout existant **n'active pas `automatic_tax`**. Ne pas activer de collecte
automatique tant que le régime, la territorialité et les règles B2B/B2C transfrontalières
ne sont pas validés. Pour les opérations concernées en France, prévoir sur facture
la mention de non-application de TVA en vigueur : depuis le 1er septembre 2026,
« TVA non applicable, art. L. 223 et s. du CIBS » ; l'ancienne référence
à l'article 293 B du CGI bénéficie d'une tolérance jusqu'au 31 décembre 2027.
Vérifier la territorialité B2C/B2B avant facturation hors France.

Stripe Tax reste `pending` : siège `head_office` absent, aucune registration.
Ne pas inventer d'adresse ni déclarer une immatriculation fiscale.
La préparation technique ne permet **aucun encaissement réel**.

## Connexion au Worker staging, production inchangée

Worker de recette : `mentioncheck-staging`, URL canonique :
`https://mentioncheck-staging.toto-rina47501.workers.dev`.
Base Supabase de staging uniquement : `ukvgnkxgzyhswgpnvyzz`.
Le fichier `wrangler.staging.jsonc` déclare les trois références de prix de CE sandbox,
`STRIPE_MODE=test` et **`BILLING_ENABLED=false`**.

Dès qu'un opérateur habilité dispose des secrets test, configurer ces secrets
**uniquement dans Cloudflare Workers > mentioncheck-staging > Variables and Secrets** :

- `STRIPE_SECRET_KEY` : clé **test** Stripe (`sk_test_...`) ;
- `STRIPE_WEBHOOK_SECRET` : signature de l'endpoint test (`whsec_...`), unique à staging.

Ne jamais écrire les valeurs dans `wrangler.*.jsonc`, une issue, un fichier .env
commité, un message ChatGPT ou un log. Vérifier l'absence de ces deux variables
dans les sources et l'absence de référence Supabase production en staging.
La page Dashboard doit conserver l'activation de paiements réels désactivée.

Endpoint Stripe Sandbox **actif côté Stripe**. Le Worker staging accepte seulement les événements Sandbox signés lorsque `STRIPE_WEBHOOK_ENABLED=true`, même avec Checkout bloqué par `BILLING_ENABLED=false`. Son secret de signature et la clé API test sont indiqués comme configurés par l'opérateur dans Cloudflare, sans vérification indépendante de leurs valeurs. ID :
`we_1Ua9vNCZ5rRirUf6nz3ROD10`. Vérifier la concordance de la clé secrète de signature avec le Worker staging avant tout envoi d'événements de test. Destiné **aux événements du compte test seulement** :
`https://mentioncheck-staging.toto-rina47501.workers.dev/api/stripe/webhook`.
La route actuelle traite `customer.subscription.created`, `customer.subscription.updated`,
`customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`,
`checkout.session.completed` (mode `subscription` uniquement) et
`payment_intent.payment_failed`. Tous ces événements passent par signature Stripe,
contrôle `livemode`, inbox idempotente `stripe_webhook_events` et relecture serveur
de la souscription courante avant synchronisation RPC transactionnelle.
`checkout.session.completed` seul ne donne jamais de droits via metadata client :
les droits viennent uniquement de la souscription relue côté Stripe.

**Ne passer `BILLING_ENABLED=true` que dans staging** après confirmation des
deux secrets, du webhook de test, de la migration `sync_stripe_subscription`,
de la configuration isolée Supabase et des tests hors ligne.
L'activation sera temporaire pour la recette ; la remettre à `false`
après essais. Ne pas modifier `wrangler.jsonc` production.

## Recette Sandbox sans appel IA payant

1. CI locale, sans réseau fournisseur : `npx vitest run tests/unit/billing-config.test.ts tests/unit/stripe-webhook.test.ts tests/unit/stripe-solo-checkout.test.ts tests/unit/stripe-staging-config.test.ts`.
2. Avant toute session Stripe : vérifier origine, authentification, un seul abonnement par compte, prix EUR et statut test.
3. Dans **Sandbox uniquement**, exécuter les scénarios carte de test côté Stripe Checkout hébergé : succès (`4242 4242 4242 4242`), 3DS/SCA (`4000 0025 0000 3155`) et refus (`4000 0000 0000 9995`) ; contrôler pour chaque offre le montant fixe, l'identifiant de client, la persistance webhook et l'évolution du plan dans **Supabase staging**.
4. Tester le portail : changement Pro → Studio, rétrogradation, résiliation en fin de période, reprise et paiement échoué ; vérifier qu'aucun ancien événement ne rétablit des droits périmés et qu'aucun compte tiers ne reçoit l'abonnement.
5. Rejouer le **même** webhook et un événement invalide ; vérifier idempotence, refus de signature et absence de fuites de secrets.
6. Supprimer les clients de test et preuves nominatives jetables selon la politique de recette, restaurer `BILLING_ENABLED=false`, contrôler le coût et **zéro appel OpenAI**.

Étapes opérateur Stripe Dashboard/CLI (création de clients de test, finalisation de session Checkout, rejouage webhook signé) : **BLOCKED** dans ce dépôt tant qu'aucun accès Stripe n'est fourni à l'agent.

## Matrice de contrôle BILLING-FINAL-001 (hors Live)

Référence CI branche : `5a1a71bd1b811e261eac3d9446b6e6da9e18c856` (run `42906259266`, `action_required`, aucun job exécuté).

| Contrôle | Statut | Preuve |
| --- | --- | --- |
| Garde-fous config (`sk_/rk_`, `whsec_`, test/live mismatch, verrous live) | PASS | `tests/unit/billing-config.test.ts`, `tests/unit/stripe-staging-config.test.ts` |
| Idempotence webhook et événements hors ordre/dupliqués | PASS | `tests/unit/stripe-webhook.test.ts`, `tests/sql/billing_sync_security.sql` |
| Cycle de droits sur `incomplete`/`past_due`/`unpaid`/annulation | PASS | `tests/unit/billing-events.test.ts`, `tests/sql/free_paid_tiers_security.sql` |
| Recette paiement Sandbox complète (cartes, 3DS, retries fournisseur, portail réel) | PARTIAL | Procédure définie ci-dessus, exécution réelle dépend d'un accès Stripe opérateur |
| Preuve de paiement Live / webhook Live / encaissement réel | BLOCKED | Interdit par périmètre : aucun appel Live, aucun encaissement |

Les tests unitaires ne prouvent pas la réception de webhooks sur Cloudflare ni
l'état d'une base distante. Enregistrer ces preuves séparément une fois la recette
effectivement passée. La préparation du catalogue n'est pas une recette E2E.

## Points à sécuriser avant un lancement commercial

- Structure juridique et identité éditrice (aucune structure créée à ce jour),
  vérification Stripe, mentions légales / CGV / rétractation / factures ;
- régime de TVA et ventes B2B/B2C internationales, validation professionnelle ;
- webhook Stripe de production, règles de paiement échoué/relances, emails transactionnels,
  approbation spécifique des conditions de commercialisation ;
- ne pas réutiliser les `price_` du Sandbox pour des abonnements live.

## Publication isolée de la PR #114 (lot de validation)

Le workflow `.github/workflows/stripe-sandbox-staging.yml` se déclenche exclusivement
sur un push de la branche `feat/stripe-sandbox-mentioncheck-20261110`,
dans le dépôt `totorina47501-wq/Project3`. Il n'a que
`contents: read` comme permission GitHub et utilise uniquement les
quatre secrets de publication **staging** déjà prévus dans le dépôt.
Les clés Stripe restent dans le Worker Cloudflare, jamais dans GitHub.

Le run effectue les contrôles de frontières, tests billing hors ligne,
TypeScript, build Next/OpenNext, dry-run, inventaire des *noms*
des deux secrets Stripe du Worker staging, publication staging
`--keep-vars`, inventaire post-publication et smokes HTTP.
Il exige `/login=200`, `POST /api/stripe/checkout=503` et
`POST /api/stripe/webhook=400` sans signature : le webhook Sandbox est
ouvert indépendamment du Checkout et refuse tout événement non signé.
**Aucun paiement, aucune souscription ni webhook signé n'est déclenché.**

Ce contrôle ne prouve pas la valeur des deux secrets ni leur rattachement
au même compte Stripe. Une recette signée et un parcours de paiement
Sandbox authentifié restent nécessaires avant l'activation temporaire
de `BILLING_ENABLED=true`. Ne pas fusionner le workflow de déploiement
à la production sous prétexte de CI verte.
## Gratuit versus Solo payant — correctif du 10 novembre

Les comptes créés sans paiement sont dans le **palier Gratuit (0 €)** avec
**3 analyses / 1 réécriture / 3 messages Mia par mois**. L'abonnement
**Solo (9 €)** conserve **30 analyses / 5 réécritures / 20 messages Mia**.
Pro et Studio conservent leurs plafonds. Ces limites sont vérifiées
dans PostgreSQL via `consume_usage_quota` et non seulement affichées.

L'enum SQL historique `account_plan=solo|pro|studio` est préservée afin de
ne pas casser les références existantes : le niveau Gratuit est **dérivé**
de l'absence d'une souscription Stripe active/trialing, du statut et de
la date de fin de période. Un simple `users.plan=solo` ou `pro`
ne suffit plus à obtenir les quotas payants. Les consommations du mois
déjà enregistrées ne sont pas remises à zéro lors d'un changement de plan :
en passant de Gratuit à Solo, les 3 analyses déjà consommées sont incluses
dans les 30. Après annulation, tout usage au-dessus du quota gratuit reste
épuisé jusqu'au mois suivant.

Migration additive : `supabase/migrations/20261110093000_free_vs_paid_solo_quotas.sql`.
**IMPORTANT : staging d'abord uniquement.** Ne pas appliquer en production
tant que le code UI et la migration ne sont pas validés et qu'une stratégie
de sortie commerciale n'a pas été approuvée. La PR #114 reste non fusionnée,
et `BILLING_ENABLED=false` est conservé.
## Préparation de la commercialisation — verrou activable après immatriculation

**Cette section ne constitue pas une activation live.** À ce jour :
l'exploitant ne possède pas encore d'immatriculation ; Stripe connecté n'est
qu'un environnement Sandbox ; les pages juridiques publiques sont encore
des brouillons. Le service ne doit pas encaisser réellement.

Le code de la PR #114 peut désormais préparer un futur mode `STRIPE_MODE=live`,
mais **tous** les éléments suivants sont nécessaires sur le Worker production
avant tout `BILLING_ENABLED=true` :

- `STRIPE_SECRET_KEY` : clé **live** du compte juridiquement vérifié ;
- `STRIPE_WEBHOOK_SECRET` : secret du webhook **live** indépendant de celui du Sandbox ;
- `STRIPE_PRICE_SOLO`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_STUDIO` : trois prix
  **live**, mensuels EUR (9/19/49 €), taxes comprises ; Checkout revérifie ces
  paramètres via l'API Stripe lors de chaque ouverture de session ;
- `STRIPE_LIVE_LEGAL_REGISTRATION` : SIREN/SIRET (sans le communiquer dans le dépôt) ;
- `STRIPE_LIVE_APPROVED=true`, `STRIPE_LIVE_TAX_REVIEW=approved`,
  `STRIPE_LIVE_TERMS_REVIEW=approved`, `STRIPE_LIVE_E2E_REVIEW=passed` :
  attestations explicites **seulement après** revue de l'identité éditeur,
  TVA/territorialité, CGV/rétractation, facturation et preuve de recette ;
- `NEXT_PUBLIC_APP_URL=https://mentioncheck.toto-rina47501.workers.dev` ;
- puis et seulement puis `STRIPE_MODE=live` et `BILLING_ENABLED=true`.

Ces indicateurs ne remplacent pas les documents et contrôles légaux nécessaires.
Configurer sur Stripe Dashboard les URL de CGV, politique de confidentialité et
contacts avant le premier paiement ; en mode live, Checkout recueille le
consentement aux CGV. Le portail client doit utiliser une configuration live,
distincte du portail de test.

Le mode test conserve `sk_test_`, les webhooks `livemode=false` et
l'absence d'encaissement. L'endpoint webhook rejette les événements de
l'autre environnement, sans accéder à la base.
Le code du portail existait côté API mais le bouton client manquait :
`/dashboard/settings` propose maintenant **Gérer mon abonnement et mes factures**
seulement lorsque le flag Stripe est ouvert et le compte utilisateur a un
`stripe_customer_id`.

## Webhooks séparés du Checkout (recette signée)

Sur **staging seulement**, `STRIPE_WEBHOOK_ENABLED=true` permet la réception
des événements Stripe Sandbox signés sans ouvrir la création de sessions
Checkout. Le contrôle de signature, la vérification `livemode=false`, le
rattachement du client à un utilisateur et le traitement idempotent restent
obligatoires. Les requêtes non signées doivent rendre HTTP 400.
Les souscriptions de test sont créées dans Stripe Sandbox **sans carte** sous
forme d'essais temporaires ; les utilisateurs factices staging sont ensuite
effacés et les preuves nettoyées. Ce chemin est distinct d'un véritable
parcours Checkout client authentifié, toujours à prouver séparément.
Le Worker de production ne déclare aucun flag `STRIPE_WEBHOOK_ENABLED`.

## Recette d'authentification Checkout (staging seulement)

Le workflow `.github/workflows/stripe-sandbox-staging.yml` réalise aussi une
recette temporisée du chemin **authentifié** :
- Crée un utilisateur synthétique avec `Supabase Auth Admin`, sans email sortant
  ni compte professionnel réel ;
- Effectue `signInWithPassword` via le même mécanisme de cookies
  `@supabase/ssr` que l'application ;
- Active provisoirement `BILLING_ENABLED=true` uniquement sur
  `mentioncheck-staging` (toujours `STRIPE_MODE=test`) ;
- Vérifie les trois vraies réponses `/api/stripe/checkout` et leurs
  URL Stripe hébergées `checkout.stripe.com`, puis la création de la
  session client `/api/stripe/portal` (`billing.stripe.com`) ;
- Efface l'utilisateur synthétique Supabase Auth dans `finally`
  et redéploie immédiatement puis à nouveau en secours la configuration
  `BILLING_ENABLED=false`. Les deux secrets Stripe demeurent dans Cloudflare,
  jamais dans GitHub Actions.

**Aucun paiement n'est effectué** : les sessions Checkout non finalisées
sont seulement des objets de test, à faire expirer dans le Sandbox après
inspection. Les tests Stripe d'interface hébergée, cartes tests et 3DS
ne sont pas automatisés ici. Le staging autorise les webhooks Stripe
Sandbox signés pour les abonnements fictifs ; la production reste inactive.

**Verrou de capacité avant activation live :** en plus des attestations précédentes, le serveur refuse Stripe live lorsque `OPENAI_PAUSED` n'est pas explicitement `false`, lorsque les capacités texte/vision ne sont pas `true` ou lorsqu'aucune clé API IA serveur n'est présente. L'utilisateur a demandé une pause des dépenses IA : ce verrou ne doit pas être contourné pour ouvrir des abonnements dont les prestations seraient indisponibles.
**Secours de déploiement :** après la restauration immédiate de `BILLING_ENABLED=false`, le workflow vérifie d'abord HTTP 503. Il ne redéploie le Worker une seconde fois que si cette preuve n'est pas obtenue, pour limiter les erreurs transitoires Cloudflare et les déploiements inutiles.

### Retour sécurisé après activation temporaire

Cloudflare `keep_vars=true` peut conserver des variables configurées dans le Dashboard. Le rollback temporisé utilise donc une configuration locale **strictement staging** avec `keep_vars=false` pour remettre explicitement `BILLING_ENABLED=false`. Selon la documentation officielle Cloudflare, les **secrets sont conservés** lors des déploiements. Après la publication, la configuration source `keep_vars=true` est restaurée dans le runner. Un contrôle HTTP exige 503 sur Checkout ; si les étapes de recette s'arrêtent avant compilation, le secours construit le Worker avant de forcer le retour à l'état désactivé. Ne jamais appliquer ce mécanisme au Worker production.

## Dossier commercial du 10 novembre 2026

Le modèle d'identité éditeur, les clauses CGV/abonnement, le formulaire de
rétractation, les données de confidentialité et la vérification fiscale sont
préparés dans [le dossier de lancement](61-dossier-lancement-commercial-2026.md).
Le texte est un **projet à compléter et à revoir**, pas des conditions
contractuelles publiables tant que l'exploitant n'est pas immatriculé.
Le mode réel reste verrouillé et les prestations IA payantes restent en pause.

## Contrôle indépendant des bases — 10 novembre 2026

Contrôle en lecture seule via Supabase sur les **deux projets distincts** :

- **Staging** `ukvgnkxgzyhswgpnvyzz` : migration `free_vs_paid_solo_quotas` présente dans l'historique (version `20261110090032`). La fonction actuelle `public.consume_usage_quota(uuid,text)` contient les bornes Solo=30, Gratuit=3, et exige une souscription Stripe identifiée pour attribuer les droits payants ; les trois tables `users`, `subscriptions`, `usage_monthly` existent.
- **Production** `zcztvberuihphqklhjsr` : cette migration est absente de l'historique. La fonction en production conserve le quota Solo sans condition de souscription Stripe. **Aucune modification de cette base n'a été effectuée par ce contrôle.**

Le correctif est donc **préparé et appliqué sur staging, pas en production**. Avant tout merge de la PR #114 ou déploiement commercial, coordonner la migration production avec le nouveau code de quotas, l'analyse d'impact sur les comptes existants et les vérifications post-déploiement. Ne pas déclarer un palier Gratuit techniquement effectif en production tant que ces opérations ne sont pas attestées. La CI GitHub `42814096059` est verte sur le SHA `4143618af3f3e599a33f98ae7890eed523391588` (quality + image runner média) ; cela **ne remplace pas** les preuves Stripe/Supabase distantes.

## Garde-fou contre les doubles souscriptions avant synchronisation webhook

La route Checkout vérifie maintenant chez Stripe, en plus de la projection SQL,
qu'aucune souscription non terminée ni session Checkout d'abonnement ouverte
n'existe pour le client. Une erreur de lecture Stripe bloque la création.
La clé d'idempotence est commune aux différentes offres pendant une fenêtre de
10 minutes, afin que deux demandes concurrentes de plans différents ne créent
pas deux sessions facturables. La recette de staging utilise **trois utilisateurs
synthétiques distincts**, un par offre, et supprime les trois comptes en fin de
recette. Aucun paiement ni souscription n'est créé. Les sessions Stripe test
incomplètes peuvent nécessiter expiration/nettoyage dans Sandbox.

L'API Stripe reste la source de vérité en cas de retard de webhook ; cette
précaution ne remplace pas les tests de concurrence en environnement isolé ni
une règle d'idempotence transactionnelle durable en cas de demandes espacées.
