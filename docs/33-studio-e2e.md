# Studio et collaborations : tests locaux de bout en bout

La fixture HTTP `scripts/e2e-fixture.mjs` conserve les parcours historiques.
Les scénarios explicites créent des comptes factices et chargent les vraies
migrations dans PostgreSQL PGlite en mémoire via `e2e-stateful.mjs`.
Les appels navigateur traversent les vraies routes Next.js puis les vraies
fonctions SQL et RLS. Auth/JWT et la frontière PostgREST sont simulés ; le
contrôle des rôles, scopes et archives est réellement exécuté en SQL.

Le serveur écoute uniquement sur loopback. Le token de service est la valeur
littérale de fixture, injectée après retrait des secrets hérités. Ce code
n’est jamais importé par les routes de production. Les endpoints de scénario
sont uniquement ceux du serveur de tests et exigent son en-tête local.

```sh
npm run test:fixtures
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e -- --workers=1
```

Le parcours Studio crée une équipe, invite un membre avec un jeton unique,
vérifie l’absence de fonctions de gestion pour le membre, crée une clé de
lecture puis contrôle son refus d’écriture et sa révocation. Le parcours
collaborations crée un brouillon lié à une vérification, l’archive, vérifie
les exports JSON/CSV/PDF et refuse la lecture par un autre compte.

Le Storage n’est pas simulé comme un téléversement réussi : ses endpoints
absents renvoient 404. Le test Storage réel reste désactivé et aucune donnée
distante n’est créée ni supprimée. Ces tests ne remplacent pas la recette
Auth/Storage du déploiement réel.
