# Corpus juridique : import contrôlé

La découverte, revue, approbation et planification existantes sont conservées. L'import ajoute une comparaison transactionnelle du snapshot approuvé, un journal minimisé et un refus intégral si le corpus a changé. Aucun texte juridique nouveau n'a été importé par cette livraison.

Aperçu sans connexion ni écriture :

```sh
node scripts/mia/run-approved-import.mjs --manifest manifeste.json --snapshot corpus.json
```

La variante connectée lit le corpus existant. Une exécution exige MIA_IMPORT_APPROVED=true, --execute et --confirm avec l'empreinte exacte de l'aperçu courant. La fonction SQL est réservée au service ; aucune insertion depuis le navigateur. Une modification invalide les vecteurs concernés, sans réindexation implicite.

Le plan d'import refuse une version antérieure pour une référence existante (`effective_on` plus ancienne). Plusieurs références peuvent partager la même URL officielle ; l'unicité reste portée par `article_ref`.

Le lecteur pagine jusqu'à 1 000 sources ; l'indexeur ne prépare que cinq embeddings par exécution explicite. Le panneau opérateur doit être relancé pour chaque lot. Les cinq documents déjà indexés ne sont pas réindexés inutilement. Les artefacts de découverte/revue restent en `verification_status=not_verified` jusqu'à validation juridique humaine explicite. Les tests hors ligne sont inclus dans `npm run test:mia:offline` et la CI.
