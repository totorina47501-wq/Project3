# Validation média — lot sans crédits OpenAI

## État confirmé
- Upload MP4 privé et SHA-256 `ready` vérifiés sur Supabase le 4 novembre 2026.
- Un ancien `pending` peut rester dans la bibliothèque ; il ne représente **pas** un fichier transféré.
- La purge existe déjà dans `app/api/internal/media-retention/route.ts` et le cron est préparé dans `workers/media-retention`. **Aucune activation automatique par ce lot.**

## Contrôles ajoutés
- Tests unitaires du cron : arrêt par défaut, destination autorisée, bearer, remontée des erreurs.
- Test Playwright authentifié du carrousel privé, opt-in via `E2E_MEDIA_UPLOAD_ENABLED=true`, avec nettoyage des seuls médias créés par le test. Ce test n'est pas exécuté sans identifiants de compte de test.

## Activation progressive de la purge (opérations manuelles)
1. Configurer un secret aléatoire `MEDIA_RETENTION_TOKEN` (minimum 32 caractères) **sur le Worker applicatif et sur le Worker cron**, jamais dans le dépôt.
2. Exécuter `POST /api/internal/media-retention` avec bearer **sans** `execute=true` pour observer le dry-run. Ne pas publier le token dans des logs.
3. Examiner les compteurs `scanned`, `eligible`, `referenced`. Le système exclut les médias référencés et attend 3 h après expiration des `pending`.
4. Une fois la suppression vérifiée sur un environnement de test, configurer `MEDIA_RETENTION_ENABLED=true` sur les deux Workers, et `MEDIA_RETENTION_URL=https://mentioncheck.toto-rina47501.workers.dev/api/internal/media-retention` uniquement sur le cron.
5. Déployer le Worker cron séparément et vérifier ses journaux. **Ne pas activer en production sans validation du dry-run et des droits.**

## Limites
- Aucun traitement vidéo FFmpeg en ligne, aucune transcription, aucun appel IA.
- Le test E2E utilise Supabase Storage et peut consommer une quantité minime de stockage/bande passante : il est volontairement désactivé par défaut.
- Les anciennes fiches `pending` peuvent être supprimées manuellement depuis Médias.
