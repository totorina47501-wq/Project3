# Analyse IA des médias préparés

Le traitement technique Cloudflare reste sans OpenAI. Une action distincte « Analyser avec Mia » transmet au maximum cinq images compressées ou les trois frames préparées ; la transcription WAV facultative nécessite le choix explicite du créateur et OPENAI_AUDIO_ENABLED=true.

POST /api/media/jobs/{id}/analyze accepte uniquement `{ "includeAudio": false }`. GET sur la même route relit les analyses sans nouveau coût. Authentification, origine, identité propriétaire, quota mensuel transactionnel et limite de débit sont vérifiés côté serveur.

Le validateur vérifie chemins, propriétaire, whitelist, manifestes, cardinalités, SHA-256, signatures et tailles avant tout appel IA. Les règles restent appliquées à la légende ; les paroles ne remplacent pas une mention écrite. Trois frames ne prouvent jamais la visibilité d'une mention pendant toute une vidéo.

Une nouvelle vérification conserve le résultat IA ; la preuve technique initiale reste intacte. L'unicité préparation/couverture interdit le double appel après double clic. Les échecs sont terminaux, les requêtes interrompues expirent après dix minutes lors de la consultation, et leur quota est restitué une seule fois. Les tokens connus des réponses mal formées sont journalisés. Les coûts audio restent estimatifs par durée ; les prompts, images et transcriptions ne sont pas copiés dans les journaux.

## Activation séparée

Appliquer la migration `20261105121000_prepared_media_ai.sql` après validation ; définir MEDIA_AI_SCHEMA_READY=true pour l'export personnel, puis MEDIA_AI_ENABLED=true pour la fonction. L'audio reste désactivé par défaut. La clé serveur existante est réutilisée. Aucune extraction de clé ni aucun appel payant n'est requis pour les tests locaux.

Documentation officielle du modèle audio conservé, consultée le 5 novembre 2026 : https://developers.openai.com/api/docs/models/gpt-transcribe ; estimation 0,0045 USD/minute. La facture fournisseur reste la référence.
