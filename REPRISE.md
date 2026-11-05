# Reprise MentionCheck — 5 novembre 2026

## Point de départ

- Dépôt : `totorina47501-wq/Project3` ; travailler sur `main`.
- Dernier commit avec recette OpenAI réelle : `0d8aec2822ef7d50fed4028f7af66ba3421bfc45`.
- Les commits tarifs/SEO jusqu’à `7f08d39` sont intégrés. Le correctif de fiabilité suivant est décrit dans [docs/39-technical-reliability.md](docs/39-technical-reliability.md).
- Les résultats OpenAI réels ci-dessous restent attachés à `0d8aec2` ; aucun appel payant supplémentaire pour ce correctif.
- Application : https://mentioncheck.toto-rina47501.workers.dev.
- Stack réelle : Next.js **15.5.28**, React 19, TypeScript strict, Supabase,
  OpenNext et Cloudflare Workers. Ne pas rétrograder vers Next.js 14 sur la
  seule base du cahier des charges initial.

## Lire avant toute modification

1. [Registre anti-doublons](docs/work-registry.json) : 21 domaines,
   35 routes et 15 fichiers de migration référencés au moment de la livraison.
2. [Bilan réel OpenAI](docs/37-real-openai-validation.md) et son
   [relevé minimisé](docs/receipts/2026-11-05-openai.json).
3. [Livraison interne précédente](docs/36-internal-delivery-validation.md),
   puis le [correctif technique](docs/39-technical-reliability.md) et le document du domaine à modifier indiqué par le registre.

Le registre décrit le code ; le bilan daté décrit les validations distantes.
Ne pas considérer une ancienne phrase « à valider » comme une tâche manquante
sans comparer avec ces preuves plus récentes.

## Déjà réalisé — éviter les doublons

- Collaborations, archives, PDF, contrôles de propriété et registre horodaté.
- Studio : espaces, rôles, invitations et clés API, avec tests locaux SQL/HTTP.
- RGPD : préférences, consentements, export paginé et demandes d’effacement ;
  tests d’effacement uniquement sur base locale jetable.
- Pipeline vidéo/carrousel, extraction FFmpeg/Sharp, file SQL, reprise et tests médias.
  Transport Storage distant, commande opt-in et conteneur livrés ; hébergement
  et démarrage non réalisés. Voir [docs/40-remote-media-runner.md](docs/40-remote-media-runner.md).
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
| `20261105082000_quota_reservation_period.sql` | `quota_reservation_period` | `20261105081854` |
| `20261105084500_private_media_outputs.sql` | `private_media_outputs` | `20261105083555` |

La réservation renvoie sa période UTC ; chaque remboursement réutilise cette période.
Les anciennes signatures sont conservées pour le déploiement progressif.

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
2. Réutiliser le transport privé livré et choisir/configurer l’hébergement du
   runner : [procédure](docs/40-remote-media-runner.md). Le bucket dérivé est créé
   privé et vide ; aucune activation. Docker est installé ici mais son démon est inaccessible.
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
# Si Chromium est fourni par le système : PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e
npm run test:e2e
OPENAI_PAUSED=true BILLING_ENABLED=false NEXT_TELEMETRY_DISABLED=1 npm run build
OPENAI_PAUSED=true BILLING_ENABLED=false NEXT_TELEMETRY_DISABLED=1 npm run test:cloudflare:bundle
```

Les tests SQL et d’effacement ci-dessus utilisent un environnement local jetable :
ne jamais envoyer leurs fixtures au projet Supabase de production. FFmpeg,
FFprobe et Chromium sont nécessaires aux tests concernés. Exécuter Playwright
avant le build, sans écritures concurrentes dans `.next`.

Résultat historique de la recette OpenAI (`0d8aec2`) : **249 unitaires**, **60 médias**, **6 suites SQL**,
**6 fixtures**, **7 RGPD**, **22 préparation IA**, **21 Playwright réussis et
1 ignoré** ; TypeScript, lint, build, bundle, CI et déploiements Cloudflare réussis.
Ces chiffres sont attachés au commit applicatif ci-dessus, pas à un futur travail.

Le correctif suivant couvre la journalisation embedding, les périodes de quota et le
CTA Solo de test. Il conserve les tarifs, le SEO et les contraintes de production.
Consulter son bilan dans [docs/39-technical-reliability.md](docs/39-technical-reliability.md).

Le raccordement Storage est livré séparément du démarrage distant. Aucun appel IA
ni transcription n’est ajouté au runner. Son guide est [docs/40-remote-media-runner.md](docs/40-remote-media-runner.md).
