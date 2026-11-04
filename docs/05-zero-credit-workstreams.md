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
