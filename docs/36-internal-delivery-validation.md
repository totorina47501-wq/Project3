# Livraison interne — validation

Base initiale : `83cd61bfcbd5d3f81a5c53c7360979a34e0dac83`.
Base finale intégrée : `14038832cbcafde62c946be7037be4998df13589`.
Les dix commits distants reçus pendant le développement sont préservés,
notamment le RAG hybride, ses outils d’indexation et la nouvelle interface Mia.
Aucune seconde implémentation de recherche n’est ajoutée ; les nouveaux tests
exercent la recherche existante avec des fournisseurs intégralement simulés.

## Code et preuves

- File média PostgreSQL, RLS, idempotence, baux, annulation et trois tentatives
  maximum. Parcours SQL → Sharp/FFmpeg → résultat et vérification archivés.
- API/UI de préparation avec contrôle d’identité, origine, corps borné,
  sources propriétaires et scores de légende calculés côté serveur.
- Conservation des références de toutes les sources et export RGPD des jobs,
  sans exposer leurs jetons de bail.
- Retrait d’exemples d’apprentissage après vérification HMAC/SHA-256 ; lots
  neufs privés, relecture imposée et évaluation comparative hors ligne.
- Effacement exécuté seulement sur une base mémoire créée par la fabrique,
  avec blocages, ordre des opérations, checkpoints, reprise et isolation.
- Trois offres simulées, événements ordonnés/idempotents et emails locaux
  avec reprise sans double livraison. Aucun checkout ni transport réel activé.
- Nouveaux parcours navigateur Studio/invitation/clé et collaboration/exports
  à travers les vraies routes et les fonctions SQL locales.
- Erreurs de lecture visibles, reprise et journalisation expurgée.

## Contrôles locaux réussis sur le contenu livré

| Contrôle | Résultat |
|---|---|
| TypeScript strict et ESLint | Réussis |
| Vitest | 239 tests, 55 fichiers |
| Médias réels | 60 tests : vidéo 27, carrousel 4, jobs/pipeline SQL 29 |
| PostgreSQL local | 11 migrations exécutées, 5 suites de régression |
| Effacement mémoire | 7 tests |
| Préparation/retrait d’apprentissage | 22 tests |
| Fixtures HTTP | 6 tests |
| Harnais SQL et registre | 9 tests ; 35 routes et 12 migrations inventoriées |
| Playwright Chromium | 21 réussites ; 1 test Storage réel désactivé |
| Build Next.js et bundle OpenNext | Réussis |

Le test Storage réel écrit puis supprime des objets distants : il reste
désactivé conformément au périmètre. Auth et frontière PostgREST des E2E
sont simulés ; PostgreSQL, RLS, règles Studio et archivage sont exécutés
réellement dans PGlite. pgvector et son opérateur ne sont pas validés par
ce harnais ; les correspondances vectorielles sont simulées dans les tests.

## Frontière de production

La nouvelle migration `20261104225500_media_processing_queue.sql` n’a pas été
appliquée à distance. `MEDIA_JOBS_SCHEMA_READY` et `MEDIA_PROCESSING_ENABLED`
restent désactivés par défaut. Le runner traite des sources locales déjà
disponibles, sans transport Storage distant ni serveur continu déployé.
Les nouvelles sorties média ne prétendent ni transcrire ni analyser par IA.

L’effacement local ne peut pas recevoir une connexion de production. Les
routes RGPD existantes restent en dry-run. Aucune purge distante n’est lancée.
Les états et données de ces laboratoires mémoire ne survivent pas à leur
fermeture ; ils ne constituent pas une sauvegarde ou un journal distant.

Aucun appel OpenAI, entraînement, indexation, encaissement, envoi d’email,
activation de fournisseur ou suppression en production n’est effectué par
cette livraison. Les mécanismes déjà présents dans main sont préservés sans
changer leurs variables distantes. La recette des fournisseurs réels,
l’hébergement du runner, les politiques de conservation opérationnelles et
l’identité juridique de l’éditeur restent à traiter séparément.
