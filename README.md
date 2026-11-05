# MentionCheck

**MentionCheckIA — MentionCheck**  
*L'IA qui check vos mentions légales avant publication.*

SaaS français d'analyse de publications sponsorisées pour créateurs et agences.

## Reprendre le projet

Lire [REPRISE.md](REPRISE.md), puis le [registre anti-doublons](docs/work-registry.json). Le [bilan réel OpenAI](docs/37-real-openai-validation.md) distingue les validations effectuées des intégrations encore désactivées.

## Stack

Cloudflare Workers + Containers à la demande + Next.js App Router + TypeScript strict + Supabase Auth/PostgreSQL/Storage + GPT-4o + OpenNext.

## Développement

Commandes : npm install, npm run dev, npm run lint, npm run typecheck, npm run test, npm run build, npm run preview:cloudflare.

Les versions exactes et leurs dépendances transitives sont verrouillées dans package-lock.json. La CI utilise Node.js et npm ci, sans activer de fournisseur.

## Fonctionnalités développées dans la branche

- Landing responsive, inscription et connexion Supabase Auth.
- Tableau de bord et historique des vérifications.
- Mode sans IA par défaut, sans appel OpenAI ni consommation du quota de checks IA.
- Préparation privée de vidéos courtes et de carrousels (sans analyse ni transcription).
- Processeur FFmpeg/FFprobe hors ligne préparé dans workers/video (extraction audio et images, sans intégration IA).
- Purge de médias expirés préparée, protégée par secret et désactivée par défaut ; aucune suppression automatisée activée.
- Analyse texte et image, scores et détection des mentions ambiguës.
- SSE, réécriture sous quota et confirmation explicite.
- Mia conversationnelle avec sources juridiques référencées, historique privé et quotas.
- Archives paginées, détail des vérifications et export PDF informatif privé.
- Paramètres de confidentialité et export JSON, navigation mobile, SEO.
- Facturation Stripe test préparée, désactivée par défaut.
- Journalisation des analyses et de leurs coûts estimés.
- Limitation de débit Cloudflare et quotas transactionnels Supabase.

**Le SaaS n'est pas encore prêt à commercialiser.** Vidéo et carrousel : préparation et stockage uniquement, aucune analyse ni transcription. Stripe reste inactif par défaut et limité aux tests. L'activation et la validation de la purge physique des médias, l'effacement RGPD complet, les mentions légales définitives, les E2E en production, Resend, les intégrations sociales et les embeddings pgvector restent à terminer.

## Documentation

- Architecture : docs/01-architecture.md
- Base SQL : docs/02-database.md
- IA : docs/03-ai.md
- Mia, archives, PDF et tests : docs/04-mia-archives.md
- Lot sans crédit IA : docs/05-zero-credit-workstreams.md
- Déploiement : docs/10-cloudflare-deployment.md
- Connexion Supabase + Cloudflare : docs/11-supabase-cloudflare-setup.md

## Environnements

Application déployée : https://mentioncheck.toto-rina47501.workers.dev. Connexion, upload privé, texte/réécriture, Vision, Mia et export RGPD ont été validés réellement le 5 novembre 2026 sur le commit `0d8aec2` ; cela ne valide pas tous les parcours en production.

Supabase et les identifiants serveur sont déjà raccordés. Comparer les migrations distantes avant toute application ; ne pas recréer les services ou leurs clés. Aucune clé ne doit être poussée sur GitHub.


### Consolidation sans consommation d'IA — novembre 2026

Préparation FFmpeg/FFprobe des vidéos et Sharp des carrousels **hors ligne**, publication atomique des résultats locaux, gestion des téléversements renforcée, modes sans IA explicitement distingués et export JSON des données avec pagination honnête. Voir `docs/05-zero-credit-workstreams.md` pour la limite exacte de ce périmètre. L'analyse vidéo et carrousel de bout en bout n'est **pas encore active sur Cloudflare**.

- Demandes d'effacement RGPD : dépôt, suivi, annulation et export des statuts, **sans suppression automatique** ni activation de services externes. Voir `docs/05-zero-credit-workstreams.md`.


### OpenAI : configuration et budget

Les modèles OpenAI texte/image historiques sont déjà câblés. Les embeddings `text-embedding-3-small` de Mia ont été validés réellement le 5 novembre 2026. La transcription reste préparée, désactivée par défaut et non validée par appel réel. Une mise en pause générale est disponible via `OPENAI_PAUSED=true`. La CI désactive les fournisseurs ; elle ne consomme pas de crédits OpenAI. Voir `docs/06-openai-setup.md`.

## Stratégie anti-doublons

Avant tout nouveau lot, consulter [le registre unique](docs/work-registry.json) et [le protocole](docs/07-anti-duplication.md) : `npm run work:find -- openai`, puis `npm run work:check`. La CI signale les routes et migrations non référencées ou réclamées par deux modules. Les statuts décrivent le code, pas une certification de production.

## Livraison interne consolidée

Collaborations privées, archivage immuable et exports de registre, Studio et clés API révocables, paramètres sociaux manuels, préférences de réécriture, quatre templates email sans envoi, exécuteur média local et préparation RGPD sont implémentés.

La migration `supabase/migrations/20261104200500_internal_completion.sql` est livrée et testée sur PostgreSQL embarqué isolé ; elle n’est pas appliquée au distant. Les polices sont servies localement. Les tests Playwright locaux utilisent une fixture Supabase HTTP sans secret, jamais la production.

Commandes : `npm run work:check`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:video:offline`, `npm run test:carousel:offline`, `npm run test:media-jobs:offline`, `npm run test:sql-harness`, `npm run test:sql:offline`, `npm run test:e2e`, `npm run build`.

Détails et limites : docs/12-internal-delivery.md, docs/13-sql-offline.md. Aucune activation OpenAI, Stripe, Resend, OAuth ou purge destructive n’est incluse.

## Préparation média Cloudflare validée

Le runner prépare réellement les carrousels et vidéos dans Cloudflare Containers,
avec stockage privé Supabase, contrôle des hashes, baux SQL et arrêt à vide.
La recette du 5 novembre 2026 sur `8091ce0` a produit 8 artefacts en deux jobs,
sans appel OpenAI. Ce périmètre ne comprend pas l’analyse IA des frames ni la
transcription. Voir [le bilan actuel](docs/41-cloudflare-containers.md) et
[REPRISE.md](REPRISE.md) avant de refaire un raccordement.
