# Audio et diagnostic commercial — 6 novembre 2026

## Audio

Le WAV privé issu du traitement média est transmis à `gpt-transcribe` seulement si le créateur coche « Inclure la transcription audio ». Le déploiement déclare désormais `OPENAI_AUDIO_ENABLED=true` ; `.env.example` garde le défaut conservateur false. `OPENAI_PAUSED=true` reste prioritaire et coupe aussi l'audio. Aucun modèle supplémentaire n'est créé, aucune clé n'est copiée.

Limites : WAV mono préparé, 60 secondes, 3 Mio, contrôles de propriété et SHA-256 avant tout appel. Les paroles constituent un contexte non fiable, jamais un remplacement automatique des mentions de la légende. Un résultat vide ou tronqué est signalé. Une réponse mal formée conserve son coût estimé dans le journal ; un échec audio donne un résultat partiel.

Les tokens non fournis ne sont pas présentés comme une transcription gratuite : estimation par durée, avec `tokenCountsReported=false` dans les métriques. Trois frames ne prouvent toujours pas la visibilité continue pendant toute la vidéo.

Recette existante sans audio : [relevé](receipts/2026-11-06-prepared-media-ai.json). La variante audio est une vérification distincte, idempotente pour la même préparation et la même couverture ; ne pas répéter les appels si elle est déjà terminée dans `media_ai_runs`.

## Dossier commercial privé

Le diagnostic réutilise `lib/billing/readiness.ts`, sans dupliquer les règles. Node 22+ et les dépendances du dépôt, dont TypeScript, sont nécessaires. Aucun SDK fournisseur n'est importé. Aucun email, paiement, mutation Supabase ou activation ne résulte de cette commande.

```sh
umask 077
cp -n docs/commercial-dossier.template.json commercial-dossier.local.json
# Compléter les champs privés avec les informations et références réelles.
node scripts/commercial/check.mjs --dossier commercial-dossier.local.json > commercial-readiness.local.json
```

Pour lire le fichier d'environnement local déjà configuré :

```sh
node --env-file=.env.local scripts/commercial/check.mjs --dossier commercial-dossier.local.json
```

Codes de sortie : 0 = champs présents pour revue, 2 = dossier incomplet, 1 = entrée invalide. Même avec code 0, `canOpenCommercial` reste false : la présence de références ne prouve pas leur approbation. Le résultat n'inclut aucune valeur privée ni secret. Les deux fichiers locaux sont ignorés par Git. Ne jamais placer les clés dans le dossier JSON.

Vérification sans fournisseur :

```sh
node --test --experimental-test-isolation=none scripts/commercial/*.test.mjs
npx vitest run tests/unit/openai-audio-adapter.test.ts tests/unit/prepared-media-engine.test.ts
```

Les scripts restent directement exécutables avec Node : `package.json` et le contrôle des liens Markdown sont réservés à la PR Copilot #34 pendant ce lot.

## Vérification du lot

TypeScript et lint réussis ; 344 tests unitaires avec les interrupteurs de la CI, 5 tests de la commande commerciale, 90 tests médias et 11 suites SQL locales passent. Playwright : 24 réussis, 1 ignoré, sans appel fournisseur. Build Next.js, bundle OpenNext et dry-run Wrangler réussis. Aucun changement de schéma ni nouvelle migration dans ce lot.

Le diagnostic lancé sans dossier dans cet environnement local retourne volontairement le code 2 et 29 champs non renseignés ; il ne permet pas de déduire les secrets déjà configurés sur le Worker. Le dossier vierge est prêt à compléter, les informations réelles ne sont pas inventées.
