# BLOC 1 — Architecture technique MentionCheck

**Projet :** MentionCheckIA / MentionCheck  
**Dépôt :** https://github.com/totorina47501-wq/Project3  
**Référence :** 03/11/2026  
**Statut :** fondations techniques, non prêt pour la production.

## Décision de sécurité

La demande initiale spécifie Next.js 14. Cette branche comporte des vulnérabilités non corrigées, notamment GHSA-2464-fhr4-w9xw. La version retenue pour production est **Next.js 15.5.28**, qui conserve l'App Router et corrige cet avis de sécurité.
Référence : https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw

## Architecture

```text
                     CRÉATEUR / AGENCE
                             |
                        HTTPS / WAF
                             |
                   CLOUDFLARE WORKERS (NEXT.JS)
          +------------------+------------------+
          |                                     |
      APP ROUTER                          API ROUTES
      LANDING / AUTH                      Session Supabase
      DASHBOARD                           Validation Zod
      CHECK / MIA / ARCHIVE               Rate Limit Upstash
      SETTINGS                            SSE / Stripe Webhook
          |                                     |
          +------------------+------------------+
                             |
                      ORCHESTRATEUR
                 +-----------+-----------+
                 |                       |
              TEXTE                 IMAGE / VIDÉO
          8 règles + GPT-4o        Storage privé
                 |                 FFmpeg / Whisper
                 |                 GPT-4o Vision
                 +-----------+-----------+
                             |
                    SCORE DE CONFORMITÉ
                      0..100 / flags
                             |
                    RÉÉCRITURE GPT-4o
                             |
                 +-----------+-----------+
                 |                       |
             MIA / RAG                ARCHIVE
          GPT-4o / pgvector        SHA-256 + UTC
                 |                  PDF + preuve
                 +-----------+-----------+
                             |
                SUPABASE POSTGRES + RLS
               AUTH / STORAGE / PGVECTOR
                             |
            STRIPE / RESEND / CLOUDFLARE KV
```

## Flux IA en six étapes

1. **Ingestion** : l'utilisateur authentifié choisit plateforme et légende, téléverse un média dans un bucket privé au moyen d'une URL signée. Zod, contrôle MIME réel, limites de tailles, antivirus si nécessaire et autorisation applicative sont vérifiés.
2. **Extraction** : normalisation du texte, SHA-256 des octets originaux, compression d'image <=1024px par Sharp. Vidéos traitées dans un worker FFmpeg isolé : 3 frames, piste audio transcrite par Whisper.
3. **Analyse parallèle** : GPT-4o texte et règles déterministes d'un côté ; GPT-4o Vision pour les images/frames de l'autre. Les résultats des deux branches sont fusionnés, sans contradiction sur la provenance des faits.
4. **Scoring** : score de conformité 0..100 et risque = 100 - conformité. Les règles discriminantes et les indicateurs IA sont tracés séparément. Le résultat n'est pas un verdict juridique définitif.
5. **Réécriture** : si conformité <60, GPT-4o propose une modification minimale, un diff et des raisons. La publication originale reste inchangée tant que l'utilisateur n'accepte pas.
6. **Archivage** : persistance dans Postgres avec horodatage UTC, hashes des données et version du prompt/modèle ; export PDF traçable. Une signature cryptographique réelle exige une clé/certificat de signature côté serveur.

### Événements de progression

`scan_text`, `scan_visual`, `scoring`, `rewriting`, `done`, `error` : transport `fetch(POST)` + flux `text/event-stream` (SSE). Pour les vidéos longues, QStash lance un job asynchrone et Redis porte les événements; un flux de consultation dédié lit l'avancement.

### Définition des scores

- `complianceScore = 0` : problème majeur de transparence ou besoin de correction.
- `complianceScore = 100` : aucun signal de non-conformité détecté par les contrôles implémentés.
- `riskScore = 100 - complianceScore`.
- `riskLevel` est dérivé des seuils de risque et des violations bloquantes, indépendamment de la formulation publicitaire de Mia.
- Les règles R1 à R7 devront distinguer obligations légales, indices de risque et conventions d'UX. R8 est une règle technique d'intégrité, pas une infraction à la loi.

## Services, environnements et droits

- **Web** : Cloudflare Workers + OpenNext, compatibilité Node.js, Route Handlers App Router, rendu serveur par défaut, client components isolés.
- **Worker vidéo** : traitement isolé Cloudflare Queues + Containers/FFmpeg (à implémenter selon le plan Cloudflare), aucun exécutable FFmpeg natif dans un Worker Next.js ; aucune URL arbitraire depuis le navigateur n'est ouverte côté serveur.
- **Données** : Supabase Auth (mots de passe uniquement dans `auth.users`), Postgres `public` RLS, Storage privé, pgvector.
- **Secrets** : Cloudflare Workers Secrets et variables de build, Supabase Vault pour les tokens sociaux ; interdiction d'exposer `service_role` au navigateur.
- **IA** : `gpt-4o` texte et vision, `whisper-1` transcription, `text-embedding-3-small` (1536 dimensions) pour RAG ; versionner les prompts et le score.
- **Paiements** : Stripe Checkout/Billing et webhooks vérifiés par signature, accès tarifaires dérivés de l'état serveur.
- **Emails** : Resend, alertes de quotas, rapports et événements d'abonnement.
- **Coûts** : Cloudflare KV pour cache IA de 30 jours sur hash de médias et version de prompt ; rate limiting Cloudflare local et quotas mensuels transactionnels dans Supabase, budgets et fair-use.
- **Isolation** : jamais accepter `userId` comme preuve d'identité ; lignes protégées RLS ; accès Studio par membership explicite.
- **RGPD** : consentement distinct/retirable pour l'entraînement, minimisation des médias, suppression planifiée, journal des accès et des préférences.
- **Transparence** : les données légales versées dans le RAG viennent de sources officielles versionnées ; toute réponse Mia renvoie les références juridiques.

## Arborescence cible

```text
mentioncheck/
├── .github/workflows/
│   ├── ci.yml
│   ├── preview.yml
│   └── security.yml
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── api/
│   │   ├── auth/login/route.ts
│   │   ├── auth/register/route.ts
│   │   ├── check/route.ts
│   │   ├── check/events/[jobId]/route.ts
│   │   ├── media/upload-url/route.ts
│   │   ├── rewrite/route.ts
│   │   ├── mia/chat/route.ts
│   │   ├── verifications/route.ts
│   │   ├── brand-deals/route.ts
│   │   ├── archive/export/route.ts
│   │   ├── stripe/checkout/route.ts
│   │   ├── stripe/portal/route.ts
│   │   ├── stripe/webhook/route.ts
│   │   └── jobs/vision/route.ts
│   ├── dashboard/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── check/page.tsx
│   │   ├── mia/page.tsx
│   │   ├── archive/page.tsx
│   │   └── settings/page.tsx
│   ├── legal/
│   │   ├── cgu/page.tsx
│   │   ├── confidentialite/page.tsx
│   │   └── mentions-legales/page.tsx
│   ├── layout.tsx
│   ├── globals.css
│   ├── page.tsx
│   ├── error.tsx
│   └── not-found.tsx
├── components/
│   ├── ui/
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── select.tsx
│   │   ├── textarea.tsx
│   │   ├── tabs.tsx
│   │   └── progress.tsx
│   ├── VerificationCard.tsx
│   ├── ComplianceScore.tsx
│   ├── ViolationList.tsx
│   ├── AIRewriteDiff.tsx
│   ├── AIStreamProgress.tsx
│   ├── MiaBubble.tsx
│   └── MiaChat.tsx
├── lib/
│   ├── ai/
│   │   ├── mentioncheck-engine.ts
│   │   ├── vision-analyzer.ts
│   │   ├── text-analyzer.ts
│   │   ├── rewriter.ts
│   │   ├── assistant.ts
│   │   ├── prompts.ts
│   │   ├── rules.ts
│   │   ├── scoring.ts
│   │   └── schemas.ts
│   ├── supabase/
│   │   ├── browser.ts
│   │   ├── server.ts
│   │   ├── admin.ts
│   │   └── database.types.ts
│   ├── security/
│   │   ├── auth.ts
│   │   ├── rate-limit.ts
│   │   ├── media.ts
│   │   └── hash.ts
│   ├── billing/
│   │   ├── plans.ts
│   │   └── quota.ts
│   ├── branding.ts
│   ├── openai.ts
│   ├── rag.ts
│   ├── stripe.ts
│   ├── resend.ts
│   ├── sse.ts
│   └── utils.ts
├── emails/
│   ├── welcome.tsx
│   ├── critical-alert.tsx
│   ├── monthly-report.tsx
│   └── subscription.tsx
├── workers/video/
│   ├── Dockerfile
│   ├── package.json
│   ├── src/index.ts
│   └── src/extract-frames.ts
├── supabase/
│   ├── config.toml
│   ├── migrations/001_initial_schema.sql
│   ├── migrations/002_rls_and_functions.sql
│   ├── migrations/003_vector_match.sql
│   └── seed.sql
├── tests/
│   ├── unit/
│   │   ├── rules.test.ts
│   │   ├── scoring.test.ts
│   │   └── rewrite.test.ts
│   ├── integration/
│   │   ├── check.test.ts
│   │   └── rls.test.ts
│   └── e2e/
│       ├── auth.spec.ts
│       ├── check.spec.ts
│       ├── mia.spec.ts
│       └── billing.spec.ts
├── public/
│   ├── logo.svg
│   ├── favicon.svg
│   └── demo/
├── docs/
│   ├── 01-architecture.md
│   ├── 02-database.md
│   ├── 03-ai.md
│   ├── 04-ui.md
│   ├── 05-legal-and-brand.md
│   ├── 06-api.md
│   ├── 07-integrations.md
│   ├── 08-security.md
│   └── 09-deployment.md
├── wrangler.jsonc
├── open-next.config.ts
├── middleware.ts
├── next.config.mjs
├── next-env.d.ts
├── package.json
├── package-lock.json
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
├── .env.example
├── .eslintrc.json
├── .gitignore
└── README.md
```

**Important :** cette arborescence est la cible des neuf blocs ; seuls les fichiers effectivement présents dans GitHub sont considérés comme implémentés. `package-lock.json` sera généré par `npm install --package-lock-only` lorsque le registre npm sera accessible.

## Dépendances directes figées

**Production :**  
- `@hookform/resolvers@7.0.1`
- `@radix-ui/react-dialog@1.3.1`
- `@radix-ui/react-popover@1.3.1`
- `@radix-ui/react-progress@1.2.1`
- `@radix-ui/react-select@2.4.1`
- `@radix-ui/react-slot@1.5.0`
- `@radix-ui/react-tabs@1.2.1`
- `@radix-ui/react-tooltip@1.2.16`
- `@supabase/ssr@0.12.7`
- `@supabase/supabase-js@2.118.0`
- `class-variance-authority@0.7.1`
- `clsx@2.1.1`
- `date-fns@4.4.0`
- `lucide-react@1.66.0`
- `next@15.5.28`
- `next-themes@0.4.6`
- `openai@7.17.0`
- `pdf-lib@1.17.1`
- `react@19.3.1`
- `react-dom@19.3.1`
- `react-dropzone@20.1.4`
- `react-hook-form@7.91.0`
- `react-markdown@10.1.0`
- `recharts@3.10.1`
- `remark-gfm@4.0.1`
- `resend@6.37.0`
- `sharp@0.35.5`
- `sonner@2.0.8`
- `stripe@23.1.0`
- `tailwind-merge@2.6.1`
- `zod@4.6.7`

**Développement et tests (ajouts Cloudflare) :**
- `@opennextjs/cloudflare@1.20.15`
- `wrangler@4.156.2`  
- `@playwright/test@1.64.1`
- `@types/node@24.19.2`
- `@types/react@19.3.0`
- `@types/react-dom@19.3.0`
- `autoprefixer@10.6.2`
- `eslint@8.57.1`
- `eslint-config-next@15.5.28`
- `postcss@8.5.31`
- `prettier@3.9.10`
- `tailwindcss@3.4.19`
- `typescript@5.9.3`
- `vitest@5.1.0`

Les versions sont figées volontairement sans `^` ni `~`. Les composants shadcn/ui sont du code local généré dans `components/ui` (pas une dépendance d'exécution dédiée). FFmpeg est un binaire du conteneur worker, non un paquet npm du frontend.

## Déploiement et validation

```bash
npm install
npm run lint
npm run typecheck
npm run build
```

Les services Supabase/OpenAI/Stripe/Resend/Upstash demandent des comptes et clés externes. Le bloc 1 ne comporte ni schéma SQL, ni moteur de vérification, ni déploiement effectif. Le test du registre npm n'a pas été possible dans l'environnement de génération ; ne pas interpréter les versions déclarées comme une preuve de compilation.

## Mise à jour Cloudflare — 03 novembre 2026

Cloudflare est l'hébergeur réel visé : **aucun compte Vercel ou Upstash n'est nécessaire**. Les services Supabase/OpenAI/Stripe/Resend sont des SaaS managés et seront activés uniquement lorsqu'ils auront des identifiants. Lire `docs/10-cloudflare-deployment.md` pour les commandes concrètes et les limites vidéo.


## Actualisation 2026-11-04

L'architecture ancienne dans ce document est une cible et ne prouve pas les fonctionnalités développées. Limiteur opérationnel : Cloudflare Workers, pas Upstash. Nouveaux parcours /dashboard/mia et /dashboard/archive décrits dans docs/04-mia-archives.md. La recherche pgvector active, la vidéo et la signature probante ne sont pas encore disponibles.
