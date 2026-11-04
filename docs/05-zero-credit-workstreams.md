# MentionCheck — travaux sans crédits OpenAI

État : développement sur branche GitHub, déploiement Cloudflare à vérifier séparément.
Aucun appel réel à GPT-4o, Whisper, aux embeddings OpenAI ni à Stripe pendant les tests de ce lot.

## Règles seules
Le contrôle sans IA est sélectionné par défaut (execution=rules_only). Il utilise uniquement les règles déterministes, sans générer de réécriture, ne consomme aucun crédit API OpenAI ni quota de check IA. Le résultat reste un signal de risque provisoire, pas une validation juridique. Une analyse GPT-4o ne peut partir que sur demande explicite (execution=ai).
Les tests Vitest bloquent fetch pour empêcher les requêtes réseau accidentelles.

## Vidéos et carrousels
Page /dashboard/media. Préparation de vidéos MP4/MOV de 60 s / 50 Mio maximum et carrousels de 2 à 5 images JPEG/PNG/WebP de 8 Mio maximum chacune. Téléversement direct vers le bucket Supabase privé, URLs signées et transfert TUS reprenable en blocs de 6 Mio pour les fichiers volumineux. Routes : /api/media/prepare, /complete, /library, /remove.
Le serveur vérifie MIME et taille réellement enregistrés. La durée annoncée côté navigateur n'est PAS encore vérifiée par FFprobe. Il n'existe pas de moteur d'analyse vidéo ni de transcription dans cette version ; les vidéos préparées ne doivent pas être présentées comme vérifiées.
Les fichiers comportent des échéances logiques de 1 h / 30 jours, mais la purge PHYSIQUE automatique n'est pas encore implémentée. Le stockage peut générer de modestes frais Supabase même sans appels IA.

Références : https://supabase.com/docs/guides/storage/uploads/resumable-uploads
https://supabase.com/docs/guides/storage/uploads/file-limits

## Confidentialité, export, légalité
/dashboard/settings : préférence de réutilisation interne des réécritures, désactivée par défaut et révocable.
/api/account/export : JSON authentifié via RLS, 1 000 lignes maximum par collection, drapeau de troncature. Aucun secret ni jeton ; les octets des médias et données des prestataires ne sont pas inclus.
Pages légales provisoires avec réserves explicites, NON adaptées à la commercialisation : identité de l'éditeur, contrats DPA, durées finales et procédure d'effacement intégral manquent.
Navigation mobile et métadonnées SEO, avec exclusion des routes privées de l'indexation.

## Facturation test
Les routes Stripe Checkout/Portal/Webhook existent mais BILLING_ENABLED=false tant que l'utilisateur ne les active pas. Même après activation, STRIPE_MODE=test, sk_test_, whsec_ et deux price IDs sont exigés. Les clés sk_live_ ne sont pas acceptées.
Webhook vérifié par signature et inbox d'idempotence en base. Les droits sont reliés au client Stripe côté serveur, pas à un userId fourni par le navigateur.
Aucun paiement réel ou appel Stripe test n'a été effectué. Tester le webhook et les annulations en Sandbox avant toute activation.

## Migrations
202611042002_media_assets.sql : RLS propriétaire en lecture, CRUD réservé au serveur.
202611042003_stripe_event_inbox.sql : idempotence service_role, jamais de payload complet.
Ne pas conclure de la réussite CI que les migrations sont appliquées ou que les routes sont déployées.

## Tests et limites
bun run typecheck, bun run lint, bun run test, bun run build.
Les tests Playwright invités ne font jamais appel à OpenAI.
Les tests authentifiés doivent utiliser un compte de test et le mode sans IA ; ils sont opt-in et ne sont pas exécutés en CI.
Le chat Mia reste une fonctionnalité IA payante si le créateur l'utilise explicitement.
La recherche vectorielle pgvector (embeddings), le traitement FFmpeg/Whisper, l'effacement RGPD, le vrai parcours Stripe, la purge Storage, les intégrations sociales et les mails Resend restent à développer ou activer.

## Préparation opérationnelle
Ne jamais enregistrer les clés dans le code ou les logs. Maintenir keep_vars dans wrangler.jsonc et --keep-vars dans Cloudflare Workers Builds. Ne pas déployer des variables d'activation Stripe avant validation des prérequis réglementaires.


## Nouveau lot — extraction vidéo locale, rétention et protections médias (novembre 2026)

**Extraction vidéo offline :** `workers/video/src/process.mjs` fonctionne
avec FFprobe/FFmpeg sur un hôte indépendant, en contrôlant réellement le
format MP4/MOV, les 60 secondes, 50 Mio, résolution, puis extraction
de trois JPEG et éventuellement d'un WAV 16 kHz. Les empreintes SHA-256 sont
dans `manifest.json`. Ni GPT-4o, ni Whisper, ni appel réseau. Ce processeur
n'est PAS déployé en tant que service et ne traite pas encore les fichiers
enregistrés par la page /dashboard/media.

**Purge des médias :** `POST /api/internal/media-retention` gère un
mode d'inventaire sans suppression et un mode `execute=true`.
Protection obligatoire par un bearer token aléatoire (au moins 32 caractères).
Le mode destructif exige en plus `MEDIA_RETENTION_ENABLED=true`, absent
par défaut. Le code supprime les blobs uniquement par Supabase Storage API
puis leur enregistrement ; il ne touche jamais directement à storage.objects.
Un média associé à une vérification archivée est exclu du nettoyage et de
la suppression manuelle.

Le retrait des médias `pending` attend trois heures supplémentaires APRÈS
leur expiration logique afin de laisser expirer les jetons d'upload signés.
Une limite de 20 objets par exécution est appliquée, avec arrêt en cas
d'erreur et nouvelle tentative lors de l'exécution suivante.
Le Worker planificateur est préparé dans `workers/media-retention`,
avec cadence quotidienne 03:15 UTC, mais il est **non déployé et désactivé**
pour éviter de supprimer des médias sans validation d'exploitation.
Les scripts ont été ajoutés sans aucune clé ni configuration active.

**Durcissement :** la validation des uploads refuse un objet expiré,
protège contre les races d'édition, vérifie l'origine des POST et bloque
la suppression d'un média devenu élément probatoire. Les mises à jour de
médias expirés sont toujours refusées même si un jeton Storage subsiste.

### Activation ultérieure (après essais manuels et revue RGPD)

1. Créer deux secrets `MEDIA_RETENTION_TOKEN` identiques dans le Worker
   principal et le Worker Cron, générés par un gestionnaire de secrets.
2. Configurer l'URL `MEDIA_RETENTION_URL` dans le Worker Cron vers
   `https://mentioncheck.toto-rina47501.workers.dev/api/internal/media-retention`.
3. Exécuter une requête d'inventaire (POST authentifié sans `execute=true`)
   et vérifier qu'aucun média archivé n'est sélectionné.
4. Seulement ensuite définir `MEDIA_RETENTION_ENABLED=true` dans
   les deux Workers, puis déployer le Worker Cron séparé en l'ayant relié
   aux secrets adéquats.
5. Suivre les logs, les retours 503, les coûts Storage et les effets de
   l'expiration sur l'interface utilisateur.

**Limites restantes :** aucun processeur vidéo réseau, aucune transcription,
aucun contrat d'effacement RGPD complet ; le planificateur n'est pas activé.
Les contrôles vidéos du navigateur ne remplacent pas la validation
FFprobe serveur avant une éventuelle analyse IA.
