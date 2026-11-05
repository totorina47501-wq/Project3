# Runner média distant — raccordement du 5 novembre 2026

## État livré

Le runner Node récupère un job par les RPC SQL déjà présentes. Il utilise les
processeurs Sharp/FFmpeg existants, sans analyse IA, OCR ou transcription.
La commande reste fermée sans `MEDIA_RUNNER_ENABLED=true`. Les flags du site
`MEDIA_PROCESSING_ENABLED` et `MEDIA_JOBS_SCHEMA_READY` ne sont pas activés par
ce lot. Il ne crée aucun paiement, email ou entraînement.

Le conteneur doit vivre sur un hôte Linux dédié capable d’exécuter FFmpeg.
Il ne s’exécute pas dans Cloudflare Workers. Aucun hébergement n’a été créé.
L’environnement de développement ne fournit ni secret serveur du runner,
ni accès au démon Docker : la configuration Compose est validée, mais l’image
n’a pas pu être construite ou exécutée ici. Ne pas confondre les tests Node
réussis et une recette du conteneur ou du transport Supabase réel.

## Transport et intégrité

- Claim serveur avec bail SQL de cinq minutes, propriétaire et jeton vérifiés.
- Sources strictement sous `<user UUID>/<file UUID>.<extension>` ; aucun lien
  public, URL arbitraire, chemin absolu ou traversée transmis au décodeur.
- Téléchargement depuis `verification-media` privé ; bornes 50 Mio vidéo,
  8 Mio/image et SHA-256 attendu revérifié avant écriture locale exclusive.
- Chaque tentative possède des dossiers locaux temporaires privés ; traitement
  via `runQueuedMediaJob` et `runMediaJob`, pas de nouveau décodeur.
- Artefacts bornés, noms autorisés, SHA-256 local revérifié ; upload immutable
  (`upsert=false`) puis relecture distante et comparaison des octets.
- Sorties sous `verification-media-derived/<owner>/<job>/<attempt>/<artifact>`.
  Le résultat SQL contient `delivery: {bucket,prefix}` sans URL signée ni clé.
- Finalisation `media_job_finish` seulement après transfert complet et si le
  bail est encore valide. Les preuves archivées comprennent ce résultat.

Les transferts Storage et la transaction SQL ne sont pas atomiques. Une panne,
annulation ou perte de bail peut laisser des sorties privées non référencées.
Elles ne deviennent pas un succès applicatif et ne sont jamais supprimées par
ce runner. Prévoir leur inventaire et une politique de rétention revue avant
exploitation. Aucune garantie de livraison exactement une fois.

## Bucket et migration

Source : `supabase/migrations/20261105084500_private_media_outputs.sql`.
Nom distant : `private_media_outputs`, version appliquée `20261105083555`.
SHA-256 : `462b043e25ec0678bf7b68015925f71b8c093670891da94aa86f09707db9c927`.

Bucket `verification-media-derived` privé, 8 Mio/objet, MIME JPEG, WebP, WAV et
JSON. Aucun droit Storage direct client n’est ajouté. Les policies existantes
restent restreintes à leurs buckets sources/contrats. Vérification distante :
bucket privé et zéro objet après migration. Aucun job n’a été lancé en production.

Le manifeste d’export RGPD inventorie aussi les sorties dérivées par préfixe
propriétaire, y compris les fichiers non référencés ; pas d’URL signée ni de
contenu binaire dans le JSON. Les demandes d’effacement restent préparatoires.

## Exécuter sur un hôte configuré

Utiliser les identifiants serveur existants dans le gestionnaire de secrets de
l’hôte ; ne jamais copier une clé dans Git, un Dockerfile, un log ou un chat.
La commande accepte l’URL HTTPS standard `<project ref>.supabase.co` seulement.
Le SDK ne persiste aucune session et vérifie que les deux buckets sont privés.

```bash
# Depuis la racine du dépôt, sur un hôte Linux avec Docker autorisé.
cp workers/media-jobs/.env.example /chemin/prive/mentioncheck-runner.env
chmod 600 /chemin/prive/mentioncheck-runner.env
# Renseigner SUPABASE_URL et SUPABASE_SERVICE_KEY dans ce fichier privé.
# Garder MEDIA_RUNNER_ENABLED=false pendant la construction.
docker compose --env-file /chemin/prive/mentioncheck-runner.env   -f workers/media-jobs/compose.yaml config --quiet
docker compose --env-file /chemin/prive/mentioncheck-runner.env   -f workers/media-jobs/compose.yaml build
# Après recette sur projet de test isolé : démarrage explicite au premier plan.
docker compose --env-file /chemin/prive/mentioncheck-runner.env   -f workers/media-jobs/compose.yaml run --rm -e MEDIA_RUNNER_ENABLED=true media-runner
```

Le conteneur tourne sous UID 1000, sans ports entrants, sans capabilities,
avec système de fichiers en lecture seule, tmpfs privés, 1 Gio mémoire,
1,5 CPU et 128 PID maximum. Aucun redémarrage automatique par défaut.
Ne pas lancer la commande ci-dessus sur la production avant la recette de l’hôte.

Alternative Node sur hôte maîtrisé : installer les dépendances du lockfile,
FFmpeg et FFprobe ; créer un dossier privé 0700, configurer les variables dans
le gestionnaire de services et lancer `npm run media:runner`. Les limites
CPU/mémoire/PID doivent alors être imposées par l’hôte.

## Arrêt, délais et erreurs

SIGINT/SIGTERM annulent le job actif et arrêtent la boucle. Chaque tentative
est bornée à 240 s, sous le bail SQL de 300 s ; décodage local limité à 120 s,
chaque requête réseau à 20 s. Le runner traite un job à la fois et vérifie le
bail pendant le calcul et entre transferts. L’API peut laisser expirer un bail
si la connexion est déjà interrompue ; la reprise reste celle des RPC existantes.

Les logs exposent seulement état, identifiant de job et code d’erreur contrôlé.
Aucun message SDK, secret, légende, URL signée ou chemin source n’y est imprimé.
Après une panne générique, la boucle attend au moins 30 s ; vide, elle attend
5 s par défaut (`MEDIA_RUNNER_POLL_MS`, 1–60 s). Aucun retry de prestataire IA.

Les fichiers temporaires de la tentative sont retirés localement dans `finally`.
Un arrêt brutal peut laisser un dossier sur hôte disque ; le tmpfs du conteneur
est jetable. Ne pas nettoyer automatiquement un volume partagé entre hôtes.

## Recette restant à effectuer

1. Construire et lancer l’image sur un hôte Docker autorisé avec secrets serveur.
2. Sur projet isolé, transférer une vidéo/carrousel synthétique, soumettre un
   job via la route existante puis vérifier fichiers, hash et résultat final.
3. Tester SIGTERM, panne réseau et annulation pendant upload ; vérifier qu’un
   job périmé ne devient jamais terminé et inventorier les fichiers orphelins.
4. Après validation opérateur, seulement alors configurer les flags du site et
   le service permanent. Ne pas activer OpenAI audio/vision dans ce runner.

## Vérifications du lot

- TypeScript et lint : réussis ; 256 tests unitaires dans 61 fichiers.
- Médias : 27 vidéo + 4 carrousels + 40 jobs, soit 71 tests réussis.
  Les 11 nouveaux tests couvrent le transport/runtime, le décodage réel et la
  finalisation PostgreSQL locale, avec Storage simulé et sans requête payante.
- SQL local : 14 migrations exécutées (pgvector explicitement omis), 8 suites
  de régression ; harnais SQL : 4 tests réussis.
- RGPD : 7 ; préparation IA : 22 ; fixtures HTTP : 6, tous réussis.
- Playwright : 21 réussis, 1 ignoré (recette Storage réelle opt-in).
- Build Next.js et bundle OpenNext/Cloudflare : réussis.
- Docker Compose : configuration validée ; image non construite (permission
  refusée sur le socket Docker). Aucune recette de conteneur déclarée réussie.
- Supabase : bucket privé vide vérifié ; alertes de sécurité inchangées.

Les appels OpenAI réels précédents sont documentés dans
[docs/37](37-real-openai-validation.md). Ils ne valident pas l’analyse IA vidéo
ou carrousel : ce runner prépare seulement les artefacts.

## Validation de l’image dans GitHub Actions

Le job `media-container` construit désormais l’image à chaque CI, sans la
publier dans un registre. Il exécute ensuite une recette dans le conteneur
sous UID 1000, sans réseau, avec les restrictions mémoire/CPU/PID et les tmpfs
privés prévus. Aucun secret fournisseur n’est injecté.

Le script monté en lecture seule prépare un carrousel et une vidéo/audio
synthétiques, contrôle trois frames, WAV, SHA-256 et reprise, puis vérifie le
refus de démarrage du runner sans opt-in. Il a été validé localement ; le
résultat du job CI fait foi pour la construction et l’exécution dans l’image.
Cette recette ne valide pas les échanges Storage réels ni un hôte permanent.

L’environnement actuel ne dispose toujours d’aucun hôte ni secret serveur du
runner. Une CI réussie ne démarre pas un service en production. Après le job,
la machine de CI est jetée et aucun média réel n’a été traité.
