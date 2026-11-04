# Jobs média locaux MentionCheck

Cet exécuteur termine la préparation **hors ligne** des jobs vidéo et carrousel.
Il appelle exclusivement `workers/video/src/process.mjs` et
`workers/carousel/src/process.mjs` : aucune seconde implémentation du décodage.
Il ne contacte ni fournisseur, ni Supabase, ni file distante et ne s'active pas
sur le site. Les routes existantes restent des préparations d'uploads.

Prérequis : Node du projet, dépendance Sharp déjà déclarée, FFmpeg et FFprobe
système dans `/usr/bin` ou `/bin`. Prévoir un hôte Unix isolé avec des dossiers
privés ; l'exécuteur ne fournit pas de sandbox système ni de limite CPU/RAM.

## Manifeste et commandes

Créer les racines d'entrée/sortie privées avant exécution. Les chemins des
entrées sont relatifs à la racine d'entrée ; URL, traversées, chemins absolus,
liens symboliques et doublons de chemin sont refusés. Les propriétés inconnues
sont refusées. Une empreinte attendue `sha256` peut accompagner chaque chemin.

```json
{
  "schemaVersion": 1,
  "id": "carousel-demo-1",
  "kind": "carousel",
  "inputs": [{"path": "image1.png"}, {"path": "image2.jpg"}],
  "timeoutMs": 120000
}
```

```sh
node workers/media-jobs/src/run.mjs job.json ./entrees-privees ./sorties-privees
node workers/media-jobs/src/run.mjs --recover carousel-demo-1 ./sorties-privees
node --test --experimental-test-isolation=none workers/video/tests/video.test.mjs workers/carousel/tests/carousel.test.mjs workers/media-jobs/tests/jobs.test.mjs
```

Une vidéo utilise `"kind": "video"` et exactement une entrée MP4/MOV. Limites
conservées : 50 Mio, 60 s, dimensions 16–4096 ; carrousel 2–5 JPEG/PNG/WebP,
8 Mio par entrée, 20 millions de pixels et dimensions 6000 maximum, sans image
animée. Les sorties restent celles des processeurs : trois JPEG et un WAV mono
16 kHz éventuel, ou WebP de 1024 pixels maximum. Les sources sont copiées dans
un instantané privé borné avant décodage et hachées sur leurs **octets réels**.

Le délai global est de 1 à 120000 ms (120000 par défaut), contrôlé aussi pendant
la préparation et la vérification. Un sous-processus isolé couvre Sharp et
FFmpeg ; son groupe Unix entier est arrêté en cas de dépassement ou annulation.
Chaque commande FFmpeg/FFprobe conserve également ses délais propres. Pour
l'API locale, importer `runMediaJob(job, {inputRoot, outputRoot, signal})` ;
`signal` accepte un `AbortSignal`. La CLI annule sur SIGINT/SIGTERM.

## Publication, reprise et récupération

Une réussite apparaît en une seule opération `rename` dans `sorties/id/` :
`media/` contient le manifeste du processeur et ses fichiers ; `result.json`
contient l'identité du job, les hashes source, les hashes/tailles de **tous** les
artefacts (y compris le manifeste du processeur), `state: completed` et
`aiCalls: 0`. Les copies source sont retirées avant publication. Les hashes
vérifient l'intégrité locale ; ce ne sont pas une signature ni une certification.

Relancer le même identifiant re-hache les sources et vérifie chaque octet,
chaque manifeste et l'ensemble exact des fichiers publiés. Une reprise valide
renvoie `state: reused` sans réécriture. Un contenu source différent produit
`JOB_CONFLICT` ; une sortie altérée produit `OUTPUT_INVALID`. Aucun dossier
final existant n'est écrasé, nettoyé ni réparé automatiquement. Un traitement
en échec, annulé ou expiré nettoie uniquement son propre stage et son verrou.
Il n'y a pas de reprise partielle d'une extraction : un nouvel essai recommence
le traitement complet, et seule une publication entièrement vérifiée est réutilisée.

Un arrêt brutal peut laisser `.id.lock` et `.id-attempt-*`. L'option `--recover`
est une action locale explicite : elle refuse un propriétaire encore vivant,
un enfant/groupe encore présent, les stages non reconnus et les liens
symboliques. L'enfant attend que son PID soit journalisé avant décodage et
s'arrête avec son groupe si le parent disparaît. La récupération est sérialisée
par `.id.recover` et ne touche jamais `id/` déjà publié. Si le verrou est tronqué,
malformé, si un PID a été réutilisé, ou si une récupération s'interrompt et laisse
`.id.recover`, une inspection opérateur du dossier privé est nécessaire ; aucun
verrou n'est forcé à partir d'un simple âge. Ne pas partager la même racine entre
hôtes ou conteneurs ayant des espaces PID différents.

Les racines privées doivent être contrôlées exclusivement par l'opérateur : les
verrous protègent les processus coopérants, pas un programme malveillant qui
remplacerait simultanément les chemins. La publication est atomique pour les
lecteurs, sans garantie de durabilité après coupure électrique (pas de fsync).
Les contrôles globaux autour des opérations de fichiers sont coopératifs ; un
blocage du disque noyau n'est pas préemptible comme le sous-processus de décodage.
Le traitement des groupes est validé sur Unix ; Windows exige un confinement
adapté de l'arbre des processus avant exploitation.

Les tests créent de vrais PNG, WebP et MP4/AAC synthétiques et inspectent le WAV
avec FFprobe, sans mocks ni appels réseau. Ils couvrent limites et corruptions,
annulation, timeout sur un enfant démarré, concurrence, hashes, sorties altérées,
reprise et récupération. `--experimental-test-isolation=none` évite une perte du reporter pipé
observée avec le runtime Node de cet environnement ; aucun test n'est skippé.

Ce pipeline ne réalise ni OCR, ni analyse IA de conformité, ni transcription.
L'intégration au site et aux prestataires reste désactivée. Aucun résultat local
ne prouve un déploiement, une analyse vidéo ou un traitement de médias de production.
