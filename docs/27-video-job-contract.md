# Contrat de traitement vidéo (non activé)

Ce lot ajoute le contrat pur de la file vidéo, sans fournisseur de queue, base de jobs ni déploiement de worker. Il ne prétend pas connecter la vidéo au site : cela nécessite une infrastructure d'exécution FFmpeg isolée, un stockage de sorties privé et une persistance atomique des états.

- Identité déterministe `SHA256(assetId:mediaSha256)` : déduplication à faire respecter par une contrainte unique en base.
- Seuls les médias `ready` avec SHA-256 persisté et chemin de propriétaire validé sont éligibles.
- États : `queued → processing → extracted`, échec avec trois tentatives maximum et lease de cinq minutes. Les transitions de ce module ne constituent **pas** un verrou distribué : le futur exécuteur doit effectuer un claim atomique en base.
- Aucun appel OpenAI, Whisper ou service IA ; `aiCalls=0`.
- `workers/video/src/process.mjs` reste l'unique implémentation FFmpeg locale et n'est pas dupliquée.
- Pour tester : `node --test workers/video/tests/job-contract.test.mjs`.

## Étape suivante avant activation
Choisir un exécuteur Linux isolé avec FFmpeg et un backend de queue ; ajouter migration de jobs + RLS sans exposer les données, claim atomique et vérification de SHA-256 des octets téléchargés ; valider le coût, la purge des sorties et les E2E authentifiés. Aucun média client n'est traité automatiquement par ce lot.
