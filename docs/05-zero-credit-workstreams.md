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

## Suivi sécurité — 4 novembre 2026, 02:18 Europe/Paris

Les POST de gestion des médias authentifiés par cookies exigent désormais un en-tête `Origin` explicite et strictement identique à l'origine de l'URL demandée. Les origines absentes, opaques (`null`), malformées, avec chemin, schéma ou port différent sont rejetées. Tests Vitest de non-régression ajoutés dans `tests/unit/media-origin.test.ts`.

Cette mesure renforce uniquement les routes utilisant déjà `isSameOrigin`. Elle ne constitue **pas** une couverture CSRF globale : auditer et harmoniser séparément les autres routes de mutation (notamment `/api/check` et `/api/account/consent`) avant commercialisation. Vérifier les appels depuis navigateur et les proxys Cloudflare : les requêtes légitimes de POST doivent fournir `Origin`. Aucun appel OpenAI, Stripe ni purge n'est requis pour ce lot.

SHA de référence avant travaux : `479dcdb702a9824846bc24780f417206ddb15877`. Correctif : `daab7ed71f2607ca81993e8c604d758783b4d4a0` ; tests : `fc5d1245b28afb75ca8dfb895bbfc6092e951890`. Statut CI de ces commits : **à vérifier**, ne pas conclure que la CI est verte sans exécution confirmée.

## Durcissement CSRF — 4 novembre 2026, 03:16 Europe/Paris

Les mutations `POST` de connexion, inscription, déconnexion, `/api/check`, consentement, acceptation de réécriture, Mia chat et suppression de conversation appliquent désormais `isSameOrigin`, comme les routes médias. Le contrôle est effectué avant toute écriture, consommation de quota ou appel à une API externe. Les requêtes sans `Origin` explicite sont rejetées avec HTTP 403. Les tests unitaires existants `tests/unit/media-origin.test.ts` couvrent le helper partagé. Les POST Stripe sont déjà protégés séparément et les webhooks utilisent leur signature ; ne pas appliquer ce contrôle au webhook serveur-à-serveur. À valider en CI et via E2E navigateur authentifié ; vérifier également les éventuels autres points d'entrée de mutation avant commercialisation. Aucune API payante n'est nécessaire pour ces contrôles.

## Validation conteneur vidéo — 4 novembre 2026, 04:19 Europe/Paris

Le validateur FFprobe exige désormais un identifiant de format `mov` ou `mp4` en tant que **jeton complet** de `format_name` (liste FFprobe séparée par virgules). Auparavant, une simple sous-chaîne `mov` ou `mp4` suffisait et pouvait accepter des identifiants trompeurs tels que `notmp4` ou `movicious`. Des tests Node natifs couvrent les formats légitimes et les noms trompeurs. Cette protection ne garantit pas à elle seule l'innocuité d'un fichier : FFmpeg/FFprobe restent à exécuter en sandbox sans réseau, avec limites CPU/mémoire et sans privilèges lors d'une future intégration serveur. Aucun appel IA ou test média externe nécessaire.

SHA de référence vérifié avant ce lot : `46271a861a0125381ba7130f8a8b08b8c9f97c48`, CI GitHub Actions run `41759733937` : `success`. Correctif : `4c96c5bd7e51ac900af9f08d7328ceb35f57fa68` ; tests : `2ff999ccdd67b5e5b21d98ef203a37cdd8aab30c`. La CI du nouveau lot doit être vérifiée séparément. Le processeur reste local et non déployé ; aucune activation Stripe, purge ou IA payante.

## Robustesse FFprobe — 4 novembre 2026, 05:10 Europe/Paris

Le validateur rejette maintenant les listes `streams` absentes, nulles ou non-tableaux avec `VideoInputError`, au lieu de provoquer une exception JavaScript inattendue. Les entrées `null` au sein d'une liste sont ignorées ; un flux vidéo valide reste obligatoire. Deux cas de régression ont été ajoutés au jeu de tests vidéo Node hors ligne, sans appel IA. Le correctif et ses deux tests ciblés ont été vérifiés localement sous Node 22.16.0 (2/2 réussis sur une reproduction isolée) ; la CI complète du dépôt reste la preuve de référence à contrôler séparément. SHA de départ : `8628e5c667ddca7251ea84bdc2724b2ff7d8b5e9`, CI GitHub Actions run `41766449346` : `success`. Correctif : `a87326e4e073ccca3c6cd9e45a812fffc7a474b4`, tests : `50e2eb3ab31080c40331529997d8edb23cba7982`. Aucun déploiement, purge, Stripe ou appel IA payant effectué. À contrôler avant intégration du processeur : limites CPU/mémoire, isolation FFmpeg et protection contre les fichiers malveillants.

## Validation durée FFprobe — 4 novembre 2026, 06:20 Europe/Paris

Le validateur refuse explicitement les durées absentes, nulles, vides, blanches ou non numériques, plutôt que de laisser les conversions JavaScript implicites décider. Les durées négatives, nulles et supérieures à 60 secondes restent interdites. Test de régression ajouté au jeu Node offline (`workers/video/tests/video.test.mjs`). Commits du lot : `78b7257a3465b98e832d020a852ecbd0dec1e7a2` (correctif), `51cbd4c356c276aed878862818f5fdeb9ec5e4cf` (tests). CI du lot à vérifier séparément ; aucune API IA, Stripe, purge ou déploiement déclenché. CI de référence précédente pour `8699392066fd823a421cb01862029b04e9e5d7a1` : GitHub Actions `41771644455`, success.
