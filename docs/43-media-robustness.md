# Robustesse du runner média — vérification hors ligne

Contrôle réalisé le 5 novembre 2026 sur le pipeline existant. Aucune nouvelle migration, activation de fournisseur, requête OpenAI ou opération en production.

## Correctif de reprise

`workers/media-jobs/src/remote-queue.mjs` distinguait mal l’indisponibilité de Storage et les données corrompues. Une erreur de téléchargement devenait `INPUT_INVALID` ; un échec d’upload ou de relecture devenait `OUTPUT_INVALID`. Ces deux codes arrêtent immédiatement un job dans la fonction SQL `media_job_fail`, même pour une panne réseau temporaire.

Les erreurs Storage retournées par le SDK, les promesses rejetées et les lectures de corps interrompues produisent désormais `PROCESS_FAILED`, avec un message générique sans détails du fournisseur. La politique SQL existante les reprend au maximum trois fois, avec son délai de 30 puis 60 secondes avant les nouvelles tentatives. Les erreurs locales non classées pendant la préparation suivent aussi ce chemin de reprise.

Une source explicitement absente (`status` ou `statusCode` égal à 404), une taille interdite ou une empreinte incohérente restent des erreurs définitives. Les uploads gardent `upsert: false` et leur préfixe propre à l’essai. Un résultat n’est référencé qu’après relecture de chaque objet et confirmation finale du bail. Les objets d’un essai devenu périmé restent non référencés ; ce contrôle ne les supprime pas.

## Régressions ajoutées

- Pannes Storage retournées et rejetées à chacun des trois points : téléchargement source, publication, relecture.
- Corps de réponse interrompu pendant la lecture d’une source ou d’un artefact.
- Reprise complète avec les vraies RPC PostgreSQL locales : statut `queued`, délai effectivement appliqué, deuxième tentative et une seule vérification conservée.
- Source 404, images vides ou supérieures à 8 Mio, vidéos vides ou supérieures à 50 Mio : refus avant lecture des octets et avant décodage.
- Objet distant dont les octets changent sans changement de taille : refus par SHA-256.
- Perte du bail après la dernière relecture : aucun appel de finalisation.
- Surveillance du bail indisponible : interruption du décodeur sans publication de succès.
- Contrôles de bail plus lents que leur intervalle : une seule requête de surveillance active.
- Observation Linux du vrai sous-processus Sharp via `/proc` : les variables OpenAI, Supabase, AWS, Stripe et Upstash injectées comme sentinelles dans le parent n’apparaissent ni dans l’environnement ni dans les arguments du décodeur.

Les contrôles existants couvrent aussi les verrous et récupérations concurrents, les hashes à la reprise, les symlinks, les traversées, l’annulation d’un enfant actif, le timeout global, les vidéos invalides et les vidéos dépassant 60 secondes.

## Validation reproductible

```sh
npm run test:media-jobs:offline
node --check workers/media-jobs/src/remote-queue.mjs
./node_modules/.bin/eslint workers/media-jobs/src/remote-queue.mjs workers/media-jobs/tests/jobs.test.mjs workers/media-jobs/tests/queue-runner.test.mjs workers/media-jobs/tests/remote-queue.test.mjs
```

Résultat de la suite média : **59 tests réussis, 0 échec, 0 ignoré**, dont 18 nouveaux cas. Sharp et FFmpeg exécutent réellement le décodage. Les migrations et RPC fonctionnent dans PostgreSQL WASM local ; les échanges Storage utilisent un client injecté en mémoire. La vérification de l’environnement enfant utilise Linux et s’ignore explicitement sur les autres systèmes.

Ces tests ne mesurent pas les permissions d’un projet Supabase distant, les latences réelles, ni la concurrence entre plusieurs connexions PostgreSQL réseau. Ils ne remplacent pas une exécution du runner déployé. Le correctif réutilise les règles SQL et le mécanisme d’activation existants.
