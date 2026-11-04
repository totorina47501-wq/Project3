# MentionCheck — protocole anti-doublons

Source de vérité : docs/work-registry.json (à maintenir dans la même PR que le code). Les anciens documents d'architecture décrivent souvent une cible, pas un état en production.

## Statuts
- implemented_code : code existant dans la branche, sans garantie de déploiement ni d'E2E.
- prepared_disabled : code préparé mais non activé (Stripe, FFmpeg/Sharp isolés, purge).
- partial : périmètre partiellement terminé, écart concret indiqué dans next.
- planned : prestation non implémentée, ne pas déduire son existence d'une dépendance package.json.

## Avant chaque nouveau développement
1. Récupérer la branche actuelle, la dernière CI, la PR #1 et les MD existants.
2. Exécuter npm run work:find -- openai (ou video, stripe, rgpd, 429...). Ouvrir anchor et test indiqués.
3. Chercher les routes, migrations et composants existants, notamment les préparations non actives, avant d'écrire.
4. Définir le plus petit écart à combler : code CI, migration réellement appliquée, build Cloudflare, E2E authentifié ou prestataire externe sont des preuves distinctes.
5. Étendre la fonctionnalité existante, ses tests et ses MD. Ne pas recréer une route ou un worker sous un autre nom.
6. Actualiser le registre dans le même commit et lancer npm run work:check puis npm run work:test.
7. Vérifier CI au SHA final. Ne jamais fusionner main, activer Stripe/OpenAI payant ou purger de médias sans accord.

## Contrôle CI automatisé
Le script scripts/work-inventory.mjs est 100 % hors ligne. Il impose un propriétaire UNIQUE pour chaque app/api/**/route.ts et supabase/migrations/*.sql, des références présentes, des IDs uniques et des statuts explicites. Toute nouvelle route ou migration non enregistrée fait échouer la CI. Une absence de résultat dans la recherche n'est pas une preuve d'inexistence : vérifier aussi les fichiers et les MD.

## Cas OpenAI 429
L'erreur 429 category=credit du 3 novembre à 23:22 UTC était suivie de deux vérifications GPT-4o full (analyse et réécriture). Ne pas refaire de clé ni acheter des crédits à cause de cette erreur passée. Vérifier le nouvel horodatage uniquement en cas de nouvelle erreur. Voir docs/06-openai-setup.md.

## Définition de terminé
Une fonction peut être terminée côté code et rester non vérifiée en production. Documenter séparément l'application des migrations, le build Cloudflare, l'E2E authentifié et les services externes. Le registre ne remplace ni les tests ni la preuve opérationnelle.
