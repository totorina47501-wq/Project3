# Régressions SQL hors ligne

`npm run test:sql:offline` ouvre PostgreSQL WASM PGlite 0.5.15 dans une base
privée en mémoire, charge les migrations présentes, puis exécute les quatre
suites transactionnelles Studio, paramètres, collaborations et confidentialité.
Aucun port, Docker, réseau, compte réel, OpenAI ou Stripe n'est utilisé. La base
est fermée et abandonnée à la fin, y compris en cas d'échec. Chaque suite annule
ses propres fixtures par `ROLLBACK`. Les noms des migrations chargées et des
suites réussies sont affichés ; une erreur SQL arrête le processus avec code 1.

Le script `scripts/test-sql-offline.mjs` lit les migrations triées dans
`supabase/migrations`. Pendant l'intégration, si une table d'un nouveau domaine
manque encore, il charge explicitement le SQL correspondant dans
`/tmp/mentioncheck-{studio,settings,collaborations,privacy}.sql`, dans cet ordre.
Ce repli est affiché. Après intégration de la migration finale, les tables
existent et aucun fichier temporaire n'est nécessaire. Une livraison doit
contenir cette migration ; les SQL temporaires ne sont pas un artefact livré.

Les contrôles du script d'adaptation se lancent avec
`node scripts/test-sql-offline.test.mjs`. Ils garantissent que les migrations
sans pgvector sont conservées octet pour octet et qu'un changement des trois
déclarations vectorielles connues oblige à adapter le harnais explicitement.

## Auth et Storage simulés

Le bootstrap crée seulement les objets nécessaires aux migrations et aux tests :

- Rôles `anon`, `authenticated`, `service_role`, ce dernier avec `BYPASSRLS`.
- Table `auth.users` minimale : UUID, email et date de confirmation. Le trigger
  réel des migrations crée le profil applicatif. `auth.uid()` lit la variable
  transactionnelle `request.jwt.claim.sub`, changée par les tests pour simuler
  plusieurs propriétaires.
- Tables de métadonnées `storage.buckets` et `storage.objects`, avec RLS sur les
  objets, et fonction `storage.foldername()` reproduisant le découpage du chemin.
  Les politiques Storage présentes dans les migrations sont réellement créées.
- Schéma `extensions` et extension **pgcrypto réelle** du paquet PGlite. Les
  empreintes SHA-256, verrous SQL, contraintes, triggers, fonctions et RLS des
  tables applicatives s'exécutent dans PostgreSQL.

Cela ne teste pas les sessions Supabase, signatures JWT, mots de passe,
rafraîchissements de cookies, OAuth, API Supabase/PostgREST, Vault, API Storage,
URLs signées, transport ou octets des fichiers. Les stubs ne constituent pas
une implémentation d'Auth ou de Storage et ne sont jamais importés par le site.
Les scénarios sont séquentiels ; ils ne constituent pas un test de charge ou
une preuve de comportement sous des connexions concurrentes.

## Périmètre vectoriel omis

Le harnais retire explicitement du schéma initial la création de l'extension
`vector`, la colonne `law_documents.embedding vector(1536)` et son index HNSW.
Il omet intégralement la migration `202611032003_pgvector_match.sql`, qui dépend
de ce type et de l'opérateur de distance. Ces omissions sont affichées dans la
sortie. Tout le reste des migrations présentes est exécuté sans modification.

Aucun type vectoriel factice, embedding simulé, appel OpenAI ou faux résultat de
recherche ne remplace ces éléments. L'extension pgvector, les dimensions,
index, opérateurs, fonction `match_law_documents` et privilèges de cette fonction
restent **non testés** par ce harnais. Le seed et le smoke SQL historique qui
vérifie cette fonction vectorielle ne sont pas exécutés par cette commande.

Ces tests apportent une preuve locale des règles transactionnelles couvertes.
Ils ne prouvent ni l'application des migrations sur Supabase, ni un déploiement
Cloudflare, ni un parcours E2E avec les vrais services.
