# Contrat de jobs vidéo — préparation sans activation
Ce lot de la PR #14 implémente un contrat **purement local** et testé. Aucun backend de queue, worker en production, transcription IA ni nouvel appel OpenAI n'est présent.

## Contrat de provenance
`createVideoJob(row, now)` reçoit **une seule ligne serveur** `public.media_assets`, lue depuis Supabase par un service authentifié et autorisé : `id`, `user_id`, `storage_path`, `media_sha256`, `status`, `kind`, `mime_type`, `actual_bytes`, `expires_at`. Ne jamais construire le paramètre en mélangeant des valeurs fournies par le client ou plusieurs lignes.

- L'identifiant `media_assets.id` et l'UUID dans `storage_path` sont distincts dans le code d'upload. Ne pas exiger leur égalité, mais **vérifier que tous les attributs appartiennent à la même ligne DB**, dans le contexte du propriétaire authentifié.
- Vérifier `ready`, SHA-256 serveur stocké, taille, MIME et expiration. Cela ne prouve PAS l'immuabilité des octets Storage. Le futur worker devra les retélécharger et re-hasher avant traitement.
- Clé de déduplication déterministe `SHA256(assetId:mediaSha256)`. La base devra imposer une contrainte `UNIQUE(key)` pour éviter une double insertion concurrente.

## États et concurrence
- `queued → processing → extracted` ou `failed`. Maximum trois tentatives ; lease de cinq minutes.
- Un `leaseToken` UUID transmis par le futur service de claim identifie la tentative. Succès/échec nécessitent le même token et un lease valide ; un token d'une tentative expirée est refusé après reprise.
- Ces transitions in-memory **ne constituent pas un verrou distribué**. Un service de jobs devra réclamer/terminer les jobs dans PostgreSQL avec une transition atomique conditionnelle `WHERE state, lease_token, lease_until`, une clé unique et une isolation par propriétaire.
- Aucun traitement `FFmpeg` ne s'exécute dans le Worker Next.js. L'unique moteur local reste `workers/video/src/process.mjs`.
- `aiCalls=0` ; aucun appel réseau dans les tests du contrat.

## Contrôles
`node --test workers/video/tests/*.test.mjs`, puis `npm run work:check`, lint, typecheck, tests unitaires, build Next.js. En production, il faudra aussi vérifier les logs **Cloudflare Workers Builds** sur le SHA de la PR ; une CI GitHub verte seule n'autorise pas le merge. Les exécutions authentifiées E2E restent à faire.

## Avant mise en service
Choisir l'exécuteur Linux isolé, limiter CPU/RAM/temps et sortie réseau, ajouter migration RLS des jobs, claim atomique en base, permissions des fichiers privés, publication atomique des JPEG/WAV/manifeste et tests de concurrence, expiration et crash. Chiffrer les coûts et obtenir une autorisation avant toute activation. Aucun média client n'est traité par ce contrat.

## Diagnostic du build Cloudflare en CI
La CI GitHub exécute maintenant le packaging local OpenNext **après** `next build` avec `bun run test:cloudflare:bundle` (`opennextjs-cloudflare build --skipNextBuild`). Cette commande prépare uniquement les artefacts Worker locaux ; **elle ne les publie pas** et n'appelle aucune API IA. Si le packaging est vert mais Cloudflare Workers Builds reste rouge, comparer les logs Cloudflare et les paramètres de build/déploiement plutôt que supposer un défaut du contrat vidéo. Cette simulation n'est pas une preuve de déploiement réel ni de compatibilité des secrets Cloudflare.

## Correctif du packaging OpenNext
Le nouveau test CI reproduit l'échec `ENOENT .next/standalone/.next/server/pages-manifest.json` après un `next build` réussi. La configuration `next.config.mjs` ne déclarait pas `output: 'standalone'`; ce mode est désormais explicite. La CI assure que le **bundle OpenNext** est réellement généré avant merge. Le build Cloudflare doit encore passer sur le SHA corrigé avant fusion ; ne pas considérer un build local comme un déploiement vérifié.
