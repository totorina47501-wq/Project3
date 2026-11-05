# Reprise MentionCheck — 5 novembre 2026

## Point de départ

- Dépôt : `totorina47501-wq/Project3` ; travailler sur `main`.
- Dernier commit applicatif validé : `0d8aec2822ef7d50fed4028f7af66ba3421bfc45`.
- Le présent lot documentaire est postérieur à ce commit et ne modifie pas le code.
- Application : https://mentioncheck.toto-rina47501.workers.dev.
- Stack réelle : Next.js **15.5.28**, React 19, TypeScript strict, Supabase,
  OpenNext et Cloudflare Workers. Ne pas rétrograder vers Next.js 14 sur la
  seule base du cahier des charges initial.

## Lire avant toute modification

1. [Registre anti-doublons](docs/work-registry.json) : 21 domaines,
   35 routes et 13 fichiers de migration référencés au moment de la livraison.
2. [Bilan réel OpenAI](docs/37-real-openai-validation.md) et son
   [relevé minimisé](docs/receipts/2026-11-05-openai.json).
3. [Livraison interne précédente](docs/36-internal-delivery-validation.md),
   puis le document du domaine à modifier indiqué par le registre.

Le registre décrit le code ; le bilan daté décrit les validations distantes.
Ne pas considérer une ancienne phrase « à valider » comme une tâche manquante
sans comparer avec ces preuves plus récentes.

## Déjà réalisé — éviter les doublons

- Collaborations, archives, PDF, contrôles de propriété et registre horodaté.
- Studio : espaces, rôles, invitations et clés API, avec tests locaux SQL/HTTP.
- RGPD : préférences, consentements, export paginé et demandes d’effacement ;
  tests d’effacement uniquement sur base locale jetable.
- Pipeline vidéo/carrousel hors ligne, extraction FFmpeg/Sharp, file SQL,
  reprise et tests médias. Son exploitation distante reste à raccorder.
- Mia : corpus juridique déjà indexé **5/5**, recherche hybride, historique,
  citations et coûts par compte. Ne pas relancer l’indexation initiale.
- GPT-4o texte, réécriture et Vision validés réellement en mode complet.
  Embedding Mia réel et réponse sourcée validés ; absence de citation hors corpus.
- Prix Solo pris en charge dans le parcours Stripe de test ; aucune activation live.

## État distant à préserver

Projet Supabase : `zcztvberuihphqklhjsr`.

| Migration source | Nom distant | Version distante appliquée |
|---|---|---|
| `20261104225500_media_processing_queue.sql` | `media_processing_queue` | `20261105000826` |
| `20261105003500_ai_usage_ownership.sql` | `ai_usage_ownership` | `20261105003303` |

Les noms de version locaux et distants diffèrent : comparer les contenus et
les empreintes du bilan avant d’appliquer une migration. La migration
d’invalidation du corpus est également déjà appliquée, version `20261104212312`.
La file a été créée sans activer son runner ni les traitements distants.

La clé OpenAI existante est dans le Worker. Ne pas demander une nouvelle clé,
la faire tourner ou chercher à l’extraire pour refaire une validation déjà passée.
Le compte technique de recette est désactivé, ses sessions sont expirées.
Les secrets et scripts temporaires ne sont pas versionnés et leur présence
dans un autre environnement n’est pas garantie.

## Contraintes de reprise

- Comparer GitHub et le travail local avant d’éditer ; préserver les changements
  concurrents. L’autorisation utilisateur actuelle vise directement `main`,
  sans nouvelle branche, PR ou fusion supplémentaire.
- Ne déclencher ni suppression/purge en production, paiement réel ou email réel.
- Des appels OpenAI réels ont été autorisés et effectués pour cette recette.
  Le lot de reprise n’en nécessite aucun ; ne pas relancer des appels payants
  uniquement pour reproduire les résultats du bilan.
- Ne pas activer le runner distant ou les autres intégrations par simple
  application des migrations. Les tests CI gardent les fournisseurs désactivés.
- Ne jamais publier cookies, mots de passe, clés ou URL signées.

## Prochain chantier utile

1. Inspecter `workers/media-jobs`, `workers/video`, `workers/carousel` et
   [le pipeline média local](docs/35-local-media-pipeline.md).
2. Définir le transport privé des sources/sorties et l’hébergement du runner
   continu en réutilisant les baux, reprises et permissions existants.
3. Recetter ce raccordement avant toute activation. L’analyse vidéo/carrousel
   de bout en bout et la transcription audio ne sont pas validées en production.
4. Traiter ensuite OAuth, email et paiement selon l’autorisation et les accès
   disponibles, puis les coordonnées légales et accords prestataires.

## Commandes de reprise et de vérification

Depuis le dépôt ; adapter les permissions réseau à l’environnement :

```bash
git status --short
git fetch origin main
git log -5 --oneline FETCH_HEAD
git diff HEAD FETCH_HEAD --stat
npm run work:check
npm run work:find -- media
```

Ne pas réinitialiser le répertoire de travail pour se synchroniser. Si nécessaire,
intégrer les changements distants en préservant les modifications locales.
Utiliser la version Node de `.nvmrc` et le lockfile existant.

```bash
npm ci --ignore-scripts
npm run typecheck
npm run lint
npm test
npm run test:video:offline
npm run test:carousel:offline
npm run test:media-jobs:offline
npm run test:sql-harness
npm run test:sql:offline
npm run test:privacy:offline
npm run test:training:offline
npm run test:fixtures
npm run test:e2e
OPENAI_PAUSED=true BILLING_ENABLED=false NEXT_TELEMETRY_DISABLED=1 npm run build
OPENAI_PAUSED=true BILLING_ENABLED=false NEXT_TELEMETRY_DISABLED=1 npm run test:cloudflare:bundle
```

Les tests SQL et d’effacement ci-dessus utilisent un environnement local jetable :
ne jamais envoyer leurs fixtures au projet Supabase de production. FFmpeg,
FFprobe et Chromium sont nécessaires aux tests concernés. Exécuter Playwright
avant le build, sans écritures concurrentes dans `.next`.

Dernier résultat applicatif : **249 unitaires**, **60 médias**, **6 suites SQL**,
**6 fixtures**, **7 RGPD**, **22 préparation IA**, **21 Playwright réussis et
1 ignoré** ; TypeScript, lint, build, bundle, CI et déploiements Cloudflare réussis.
Ces chiffres sont attachés au commit applicatif ci-dessus, pas à un futur travail.
