# MentionCheck

**MentionCheckIA — MentionCheck**  
*L'IA qui check vos mentions légales avant publication.*

SaaS français d'analyse de publications sponsorisées pour créateurs et agences.

## Stack

Cloudflare Workers + Next.js App Router + TypeScript strict + Supabase Auth/PostgreSQL/Storage + GPT-4o + OpenNext.

## Développement

Commandes : npm install, npm run dev, npm run lint, npm run typecheck, npm run test, npm run build, npm run preview:cloudflare.

Le dépôt ne dispose pas encore de lockfile enregistré. La CI utilise Bun avec les versions exactes du package.json.

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

Le Worker de fondation a été publié sur https://mentioncheck.toto-rina47501.workers.dev ; cela ne valide pas encore les nouvelles routes privées.

Créer et connecter Supabase, appliquer les migrations, ajouter les variables Cloudflare puis effectuer les tests d'accès. Aucune clé ne doit être poussée sur GitHub.


### Consolidation sans consommation d'IA — novembre 2026

Préparation FFmpeg/FFprobe des vidéos et Sharp des carrousels **hors ligne**, publication atomique des résultats locaux, gestion des téléversements renforcée, modes sans IA explicitement distingués et export JSON des données avec pagination honnête. Voir `docs/05-zero-credit-workstreams.md` pour la limite exacte de ce périmètre. L'analyse vidéo et carrousel de bout en bout n'est **pas encore active sur Cloudflare**.

- Demandes d'effacement RGPD : dépôt, suivi, annulation et export des statuts, **sans suppression automatique** ni activation de services externes. Voir `docs/05-zero-credit-workstreams.md`.


### OpenAI : configuration et budget

Les modèles OpenAI texte/image historiques sont déjà câblés. Transcription `gpt-transcribe` et embeddings `text-embedding-3-small` sont préparés côté serveur mais **non activés**. Pas de nouvelles requêtes API pour la préparation ; une mise en pause générale est disponible via `OPENAI_PAUSED=true`. Voir `docs/06-openai-setup.md`.

## Stratégie anti-doublons

Avant tout nouveau lot, consulter [le registre unique](docs/work-registry.json) et [le protocole](docs/07-anti-duplication.md) : `npm run work:find -- openai`, puis `npm run work:check`. La CI signale les routes et migrations non référencées ou réclamées par deux modules. Les statuts décrivent le code, pas une certification de production.
