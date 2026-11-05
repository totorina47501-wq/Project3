# Runner média sur le forfait Cloudflare existant

Autorisation : utilisateur confirme son forfait Cloudflare payé et demande de l'utiliser.

1. Réutiliser le pipeline Node et Storage existant en ajoutant un mode one-shot.
2. Exporter un Durable Object via un Worker OpenNext personnalisé, sans nouvelle
   clé ni nouveau fournisseur. Configuration Containers dans le Wrangler existant.
3. Réveiller l'objet après enqueue authentifié. Alarmes durables : démarrer une
   seule instance sur travail disponible, surveiller puis arrêter ; aucun cron idle.
4. Injecter les secrets Supabase du Worker au conteneur au runtime seulement.
5. Tester contrôle d'accès, absence de démarrage à vide, one-shot, watchdog,
   reprises, quotas de démarrage et packaging OpenNext. Réutiliser Workers Builds.
6. Publier sur main, contrôler le déploiement complet et effectuer une recette
   média fictive réelle sans OpenAI, puis désactiver le compte de recette.

Les limites des alarmes et de l'API Container sont vérifiées dans les docs
Cloudflare. Aucun secret extrait. Si le build intégré manque de droits,
conserver le résultat et rapporter précisément ce blocage.
