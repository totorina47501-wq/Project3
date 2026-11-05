# SaaS Factory — inventaire du socle réutilisable

Cet inventaire complète [le plan SaaS Factory](../43-saas-factory.md) par un
relevé du code présent dans Project3. Il décrit des **sources de référence**,
pas un template prêt à copier ni une preuve de déploiement. L'extraction se fera
dans un dépôt indépendant, par sélection et revue explicites.

## Inventaire vérifié

| Besoin | Sources candidates | Réemploi envisageable et limites |
|---|---|---|
| Next.js et TypeScript strict | `package.json`, `package-lock.json`, `.nvmrc`, `tsconfig.json`, `next.config.mjs`, `next-env.d.ts` | Reprendre la configuration comme point de départ. Conserver une version Next.js corrigée et valider le couple Node/Next. Ne pas reprendre le manifeste complet ni son lockfile : ils embarquent les intégrations et scripts du produit. |
| Styles et structure App Router | `app/layout.tsx`, `app/globals.css`, `postcss.config.js`, `tailwind.config.ts` | Réutiliser les réglages techniques après retrait des métadonnées, polices, couleurs, textes et chemins de marque. La feuille globale et le thème contiennent des choix visuels MentionCheck ; ils ne constituent pas un design system neutre. |
| Authentification Supabase | `lib/supabase/browser.ts`, `lib/supabase/server.ts`, `lib/security/auth.ts`, `middleware.ts` | Références de mise en place des clients, sessions et vérification serveur de l'identité. À reconfigurer et revoir pour les routes et le modèle d'accès du nouveau produit ; ne pas en déduire une autorisation métier générique. |
| Journalisation minimale | `lib/security/logging.ts` | Le filtrage par liste fermée est un modèle utile, mais le nom d'événement et les noms de variables sont liés au produit. Adapter les champs autorisés et tests au nouveau service ; ne jamais journaliser de valeur secrète ou de contenu utilisateur. |
| SEO et URL publiques | `app/robots.ts`, `app/sitemap.ts`, `lib/site-url.ts`, `app/layout.tsx` | Réutiliser les mécanismes après remplacement des métadonnées, du domaine, de la langue et des pages indexables. Aucun domaine ni contenu légal de Project3 n'est une valeur de départ valide. |
| Contrôle statique et format | `.eslintrc.json`, `.prettierrc`, `tsconfig.json` | Référence de configuration uniquement ; vérifier compatibilité avec les versions de dépendances retenues par le nouveau projet. |
| Tests et isolation réseau | `vitest.config.ts`, `playwright.config.ts`, `tests/setup/block-network.ts` | Le blocage réseau des tests unitaires et l'usage de Playwright sont réutilisables comme principes. Adapter les fixtures, données, commandes et tests d'authentification ; ceux de Project3 simulent ses propres parcours. |
| Harnais SQL local | `scripts/test-sql-offline.mjs`, `scripts/test-sql-offline.test.mjs` | Le mécanisme de test isolé peut servir de référence. Les tests et fixtures sous `tests/sql/` ainsi que le schéma Project3 ne sont pas un socle de données à recopier. |
| Qualité continue | `.github/workflows/ci.yml`, scripts `lint`, `typecheck`, `test`, `build` de `package.json` | Garder une seule CI et sélectionner les contrôles réellement nécessaires. Le workflow actuel inclut des étapes spécifiques (conteneur média, FFmpeg, Chromium et bundle Cloudflare) et ses protections fournisseurs doivent être adaptées, pas copiées aveuglément. |
| Cloudflare / OpenNext | `open-next.config.ts`, `workers/cloudflare-entry.mjs`, `wrangler.jsonc` | Les points d'intégration OpenNext peuvent guider une configuration neuve. Ne pas copier `wrangler.jsonc` : nom de Worker, identifiants de rate-limit, bindings, variables, conteneur et réglages d'exploitation sont propres au compte et au produit. |
| Observabilité | bloc `observability` de `wrangler.jsonc`, `lib/security/logging.ts` | Référence Cloudflare uniquement ; vérifier les coûts, la rétention et la minimisation avant activation dans un nouveau compte. Aucun fournisseur d'observabilité multi-hébergeur n'est abstrait ici. |
| Paiement | `lib/billing/`, `app/api/stripe/`, `tests/unit/billing-*` | À traiter comme exemples du parcours Stripe de Project3, pas comme module générique. Un éventuel module d'usine doit être opt-in, limité au mode test, utiliser ses propres prix et validations et échouer fermé hors test. |
| API versionnée | `app/api/v1/`, `docs/api/`, `sdk/mentioncheck.ts` | Les conventions de versionnement et de documentation sont des exemples. Routes, schémas, SDK et réponses sont orientés vérification MentionCheck et ne sont pas un contrat SaaS générique. |

### Limites du socle UI et i18n

`components/` contient des composants de fonctionnalités MentionCheck (Mia,
conformité, médias, collaborations, Studio, confidentialité et paiement) ; il
n'existe pas de répertoire `components/ui/` autonome à extraire. Ne pas présenter
ces composants comme un design system générique. La langue française et les
métadonnées sont définies dans `app/layout.tsx` ; aucune bibliothèque ou couche
i18n dédiée n'est identifiée. L'internationalisation doit être conçue pour le
nouveau produit au lieu de supposer qu'un paramètre de langue suffit.

## Exclusions obligatoires

Ne jamais inclure dans un template ou une génération :

- **Mia / RAG / juridique :** `lib/mia/`, `scripts/mia/`, toute indexation,
  embeddings, corpus, citations et règles ou textes juridiques de conformité ;
  de même pour les moteurs, prompts, règles et résultats propres à MentionCheck.
- **Données et fixtures :** `supabase/seed.sql`, données client, comptes,
  historiques, journaux, fichiers privés, fixtures métier ou reçus de validation.
  Les exemples d'environnement ou de tests ne doivent pas fournir d'identifiants
  réutilisables.
- **Secrets et identifiants d'infrastructure :** valeurs d'environnement,
  secrets de fournisseurs, identifiants Supabase/Cloudflare, bindings ou URLs
  propres à un compte ; ne pas lire, exporter ni reporter les secrets de
  l'environnement de travail. `.env.example` n'est pas copiable tel quel :
  reconstruire une liste de noms autorisés avec des valeurs vides.
- **Marque et contenu :** `lib/branding.ts`, contenu et métadonnées de pages,
  polices, couleurs, domaines, handles, plans et prix, textes juridiques ou
  commerciaux et tout nom « MentionCheck » ou « Mia ».
- **Migrations métier :** tout `supabase/migrations/**`, politiques RLS,
  fonctions, seeds, schémas et stockage. Un nouveau produit doit concevoir et
  tester son propre schéma et ses politiques ; l'authentification seule ne
  justifie pas de réutiliser les migrations.
- **Exécution liée à la production :** paramètres de déploiement, routeurs,
  runners et workflows qui activent un service distant. En particulier, le
  workflow `factory-safe-automerge.yml` est une politique de ce dépôt, pas une
  partie du générateur ou du template.

La règle de sélection est une liste positive de fichiers revue et versionnée.
Copier tout le dépôt puis tenter d'effacer les éléments interdits est exclu.

## Dépendances et risques d'extraction

- **Versions et graphe npm :** `package.json` épingle les versions, mais mélange
  Next.js/React, Supabase, Stripe, OpenAI, Resend, médias et outils Cloudflare.
  N'importer que les paquets nécessaires aux modules retenus ; résoudre et
  auditer le graphe du projet généré, puis créer son propre lockfile. Vérifier
  Node selon `.nvmrc` et `engines` plutôt que de figer ces versions pour tous
  les futurs SaaS.
- **Fournisseurs et coûts :** une dépendance installable n'implique pas un
  fournisseur gratuit. IA, paiement, email, stockage, conteneurs et
  observabilité restent désactivés par défaut. Ne pas inclure de clé ni appeler
  un fournisseur pendant la génération ou la CI.
- **Authentification et isolation :** `requireUser()` et le middleware
  vérifient la session, mais l'autorisation des données dépend des routes, du
  schéma et des politiques RLS. Reconcevoir tenant, rôles, politiques, secrets
  serveur et tests dans le projet cible ; aucune clé privilégiée ne va au client.
- **Cloudflare :** le wrapper et la configuration existants s'appuient sur
  Workers/OpenNext, des bindings et un runner média opérationnel. La
  compatibilité runtime, disponibilité, région, limites et coûts doivent être
  évalués pour le nouveau compte. La configuration présente n'est ni neutre ni
  sûre à déployer ailleurs.
- **Tests et CI :** les suites contiennent des données et hypothèses spécifiques
  au produit. Le job complet dépend notamment de Chromium, FFmpeg et Docker ;
  isoler les tests utiles et garder les fournisseurs désactivés. Une CI verte
  ne valide pas les migrations distantes, les secrets, un déploiement ou une
  recette de production.
- **SEO, langue et légal :** les URLs canoniques, pages indexables, mentions
  légales et traductions sont propres à chaque projet et doivent être validées
  avant publication.

## Contrat proposé du générateur

### Entrée déclarative

Accepter un manifeste versionné, strict et sans valeurs secrètes, avec les
champs suivants :

| Champ | Contrat |
|---|---|
| `schema_version` | Version du format d'entrée ; refuser les versions inconnues. |
| `project_slug` | Identifiant stable limité à une forme normalisée minuscule ; refuser séparateurs de chemin, caractères ambigus et collisions. |
| `product_name` | Nom d'affichage, sans être utilisé comme chemin ou fragment de code. |
| `domain` | Nom DNS validé, facultatif tant que sa possession n'est pas confirmée ; aucune écriture DNS ou configuration de domaine automatique. |
| `languages` | Liste non vide de codes de langue supportés ; le générateur refuse une langue qu'il ne sait pas produire. |
| `modules` | Liste fermée de modules optionnels (par exemple `supabase-auth`, `api`, `stripe-test`, `media`). Absents par défaut ; `ai` ne peut être demandé qu'en état explicitement désactivé. Refuser toute option inconnue. |
| `deployment_target` | `none` par défaut, ou cible supportée explicitement telle que Cloudflare Workers ; la génération ne déploie rien. |
| `environment` | Noms de variables issus d'une liste blanche par module, jamais leurs valeurs. Tout secret, champ non reconnu ou variable publique contenant une valeur est refusé. |

Valider le manifeste complet avant toute écriture. Les valeurs sont des données,
jamais des chemins de fichiers, du code, des commandes shell ou des expressions
de template. Refuser les chemins absolus, la traversée `..`, les collisions et
les substitutions qui sortent du répertoire cible. Échapper les noms affichés
selon le contexte de génération.

### Sortie et garanties

- Générer dans une destination vide et séparée, depuis une allowlist de
  templates versionnés ; produire un manifeste de fichiers et leurs empreintes
  pour revue.
- Inclure un `.env.example` reconstruit avec seules les variables autorisées et
  valeurs vides, un README propre au projet, les tests sélectionnés, une CI
  locale/sans fournisseur et une checklist d'activation manuelle.
- Établir la configuration de sécurité à partir du projet cible : aucun schéma
  ou migration métier importé, aucune clé, aucun ID de compte et aucun domaine
  non vérifié. Les modules d'authentification exigent une revue dédiée des
  routes, du modèle tenant et de la RLS.
- Ne pas installer ni ajouter de fournisseur payant par défaut. Les modules
  `stripe-test` et `media` sont opt-in, explicitement documentés et ne doivent
  pas pouvoir déclencher de mode live, d'appel fournisseur ou de déploiement
  lors de la génération et des tests.
- Ne pas créer de dépôt GitHub, issue, secret, ressource Cloudflare/Supabase,
  paiement ou déploiement sans étape distincte et approbation humaine.
- Fournir un mode prévisualisation déterministe (liste/diff des fichiers) avant
  écriture et échouer sans modifier une destination existante.

Le périmètre initial recommandé est un squelette Next.js/TypeScript minimal,
CI locale hors fournisseur, tests de base et documentation. Auth, Stripe,
médias et hébergement doivent rester des modules séparés à activer après
validation de leurs risques ; l'IA reste désactivée.

## Références de l'audit

- [REPRISE.md](../../REPRISE.md) : état et garde-fous du dépôt.
- [Registre de travail](../work-registry.json) : fonctionnalités, routes,
  migrations, tests et documents existants.
- [Plan SaaS Factory](../43-saas-factory.md) : stratégie, exclusions et
  automatisation documentaire.
- [Architecture](../01-architecture.md), [sécurité](../12-privacy-security.md),
  [CI](../17-ci-release-gates.md), [SEO](../19-seo-release-plan.md) et
  [déploiement Cloudflare](../10-cloudflare-deployment.md) : détails et limites
  des domaines cités ci-dessus.
