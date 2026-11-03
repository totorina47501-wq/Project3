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
- Analyse texte et image, scores et détection des mentions ambiguës.
- SSE, réécriture sous quota et confirmation explicite.
- Journalisation des analyses et de leurs coûts estimés.
- Limitation de débit Cloudflare et quotas transactionnels Supabase.

**Le SaaS n'est pas encore intégralement prêt à commercialiser.** Vidéo, carrousel, chat Mia RAG, Stripe, Resend, export PDF, documents RGPD et intégrations sociales restent à développer et tester.

## Documentation

- Architecture : docs/01-architecture.md
- Base SQL : docs/02-database.md
- IA : docs/03-ai.md
- Déploiement : docs/10-cloudflare-deployment.md
- Connexion Supabase + Cloudflare : docs/11-supabase-cloudflare-setup.md

## Environnements

Le Worker de fondation a été publié sur https://mentioncheck.toto-rina47501.workers.dev ; cela ne valide pas encore les nouvelles routes privées.

Créer et connecter Supabase, appliquer les migrations, ajouter les variables Cloudflare puis effectuer les tests d'accès. Aucune clé ne doit être poussée sur GitHub.
