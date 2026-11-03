# MentionCheck

**MentionCheckIA** — **MentionCheck**  
*L'IA qui check vos mentions légales avant publication.*

SaaS français d'analyse et de correction de la transparence des partenariats commerciaux pour créateurs, freelances UGC et agences.

## Démarrage

Prérequis : Node.js 22 LTS ou 24 LTS, npm, puis :

```bash
npm install
npm run dev
```

Visiter http://localhost:3000.

## Hébergement Cloudflare

Le projet est configuré pour **Cloudflare Workers + OpenNext**, sans Vercel ni Upstash. Les comptes Supabase, OpenAI, Stripe et Resend seront créés et connectés au fur et à mesure. 

```bash
npm install
npm run preview:cloudflare
# Déploiement après vérification :
npm run deploy:cloudflare
```

Voir [le guide de déploiement Cloudflare](docs/10-cloudflare-deployment.md). Aucun déploiement n'a encore été exécuté.

## Références

- [Bloc 1 — architecture technique](docs/01-architecture.md)
- Bloc 2 : base de données Supabase / RLS.
- Bloc 3 : moteur IA multimodal.
- Bloc 4 : interfaces publiques et privées.
- Bloc 5 : marque et documents juridiques.
- Bloc 6 : API et abonnements.
- Bloc 7 : intégrations externes.
- Bloc 8 : sécurité et coûts IA.
- Bloc 9 : déploiement et lancement.

## Sécurité

Le repo ne doit pas contenir de clés privées. Les identifiants sont exclusivement transmis par variables d'environnement serveur. Le socle utilise Next.js 15.5.28, choisi à la place de Next.js 14 pour bénéficier des correctifs de sécurité.

## État

Socle de projet en cours de construction, **non prêt pour la production**. Voir l'arborescence cible dans le bloc 1.
