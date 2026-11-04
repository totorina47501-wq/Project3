# Prochain lot : preuve persistante et traitement média isolé

Statut : **contrat de préparation uniquement**. Aucun déploiement de queue, migration appliquée, appel IA ou activation de purge.

## Inventaire confirmé (ne pas dupliquer)
- `app/api/media/prepare/route.ts` : authentification, CSRF, quota, insertion pending, URL d'upload privée.
- `app/api/media/complete/route.ts` : vérification MIME/taille, SHA-256 des octets privés, transition pending→ready.
- `lib/evidence/private-media.ts` et `lib/evidence/sha256.ts` : hash côté serveur.
- `workers/video/src/process.mjs` : FFprobe, FFmpeg, trois images, manifest SHA-256, traitement hors ligne.
- `workers/carousel` : traitement local Sharp.
- `app/api/internal/media-retention/route.ts` : purge désactivée.
- `supabase/migrations/202611042002_media_assets.sql` : RLS propriétaire et statut pending/ready.
- `tests/e2e/authenticated-navigation.spec.ts` : authentification optionnelle existante.

## Contrat de persistance à implémenter après revue
1. Vérifier les migrations déjà appliquées et le schéma réel, ne pas rejouer aveuglément le SQL.
2. Ajouter `media_sha256` nullable, exactement 64 caractères hexadécimaux minuscules, uniquement dans une migration versionnée. Les anciens objets restent NULL (jamais de faux hash).
3. Dans `complete`, faire une transition conditionnelle `pending`→`ready` enregistrant simultanément SHA-256, taille, date. Retourner la valeur persistée, y compris lors d'une répétition légitime.
4. Refuser le cas où l'objet Storage est modifié entre lecture et validation ; vérifier l'absence de remplacement après confirmation et conserver une preuve de version/immutabilité avant d'affirmer la chaîne de conservation.
5. Ne jamais exposer les chemins privés, les jetons d'upload ou les clés service_role dans la réponse publique. La bibliothèque peut afficher un état d'intégrité sans exposer le hash si inutile.

## Contrat du worker vidéo
- Un job unique par `asset_id + media_sha256` ; propriétaire validé par le serveur.
- `queued → processing → extracted` ou `failed`, verrou/lease, tentative bornée, reprise idempotente.
- Worker isolé hors Cloudflare request handler, sans réseau pendant FFmpeg, limites CPU/RAM/temps et utilisateur non privilégié.
- Lecture du blob privé via identité serveur et vérification de SHA-256 avant décodage.
- Sorties temporaires privées, publication atomique des frames, WAV et manifest ; aucune publication partielle.
- Pas de transcription ni de verdict juridique vidéo ; `aiCalls=0`.
- Aucune activation sans revue RLS, quotas, sécurité, coût et preuve E2E authentifiée.

## Matrice de tests à compléter
| Scénario | Résultat attendu |
|---|---|
| Mauvais propriétaire | 404/403, aucun accès Storage |
| Objet absent, taille/MIME incorrect | 422, reste pending |
| Octets altérés | Échec d'intégrité, pas de ready |
| Confirmation répétée | Réponse stable sans second job |
| Deux confirmations concurrentes | Une seule transition et un seul job |
| Vidéo > 50 MiB ou > 60 s réelle | Refus sûr |
| Fichier invalide ou FFprobe indisponible | Échec borné, pas de résultat publié |
| Crash worker après extraction partielle | Aucune sortie visible, reprise contrôlée |
| Média déjà archivé | Jamais purgé |
| CI sans identifiants E2E | Tests authentifiés explicitement skipped |
| IA désactivée | Aucun appel réseau payant |

## Points bloquants à vérifier
- Disponibilité et limites mémoire/CPU du runtime Cloudflare pour le hash synchrone 50 MiB ; si excessif, déplacer le calcul vers un worker asynchrone avant rollout.
- État réel des migrations Supabase et des droits Storage.
- Choix et coût d'un exécuteur FFmpeg séparé.
- Tests E2E authentifiés sur un environnement de test sans médias sensibles.

Cette préparation ne doit pas être interprétée comme une fonctionnalité livrée.
