# Confidentialité et sécurité — code préparé le 4 novembre 2026

Ce document décrit le code de la branche, sans preuve de déploiement ou d’application des migrations. Aucun effacement réel, Cron, appel OpenAI ou Stripe n’a été exécuté pendant ces travaux.

## Consentement et retrait

`POST /api/account/consent` vérifie l’identité via `requireUser`, l’origine exacte, un objet JSON strict et une limite réelle de 2 Kio. La RPC `set_training_consent` utilise exclusivement `auth.uid()` : aucun identifiant utilisateur n’est accepté du navigateur. Si cette RPC n’est pas déployée, le service échoue sans annoncer une sauvegarde réussie.

La migration proposée ajoute un journal de changements et deux triggers. Un retrait met tous les `training_consent_snapshot` existants à `false` dans la même transaction. Toute insertion ou mise à jour de feedback vérifie aussi le consentement actuel sous verrou du profil, pour couvrir l’insertion concurrente après une lecture périmée de la préférence. Une réactivation ne réautorise pas les anciens feedbacks. Le journal initial de migration porte `source=migration_baseline` : il ne constitue pas une preuve de date de consentement antérieur.

Aucun entraînement, export de dataset ou fournisseur de modèles internes n’est activé. Le retrait exclut les contenus des utilisations futures ; il ne prouve pas le désapprentissage d’un modèle déjà entraîné, ni l’effacement d’éventuelles copies externes antérieures. Tout futur extracteur de dataset doit vérifier le snapshot **et** la préférence actuelle avant utilisation.

## Export personnel

`GET /api/account/export` réauthentifie le compte. Le serveur lit des colonnes explicites et filtre chaque collection par le propriétaire identifié : profil et références de facturation, données de compte Auth sans identifiants de connexion secrets, vérifications, conversations, collaborations et leurs snapshots/liens, abonnements, comptes sociaux déclarés sans références Vault, préférence de ton de réécriture, quotas, feedbacks complets, médias, analyses et réponses brutes, demandes/journaux RGPD, équipes possédées, appartenance personnelle, invitations émises/reçues/acceptées, clés émises sans hash ni jeton, vérifications d’équipe créées par le compte.

Les lectures privilégiées ne consultent jamais l’historique privé des autres membres. Les analyses sont limitées via une jointure interne avec `verifications.user_id`. Les données partagées appartenant aux autres membres ne sont pas exportées en tant qu’historique privé. Les nouvelles tables Studio et collaboration ainsi que la migration confidentialité sont des prérequis de cet export ; un schéma incomplet provoque un échec explicite sans JSON déclaré complet.

Chaque collection utilise un décompte exact et plusieurs plages ordonnées par clé unique. Une page réduite par `max_rows` n’arrête pas la lecture : le curseur avance du nombre effectivement reçu. Une réponse vide prématurée, un décompte changeant, plus de 100 000 lignes dans une collection ou plus de 25 Mio de données déclenchent un échec explicite ; une extraction accompagnée reste alors nécessaire. Les lectures ne forment pas un instantané transactionnel : éviter les modifications pendant l’export.

Le manifeste `privateFiles` inventorie les objets des buckets privés `verification-media` et `deal-contracts` sous le seul préfixe `<user.id>/`, y compris les dossiers imbriqués, sans lien signé. Il fournit chemins, identifiants et métadonnées ; les octets sont exclus. L’inventaire Storage est limité à 100 000 entrées et 16 niveaux. `information.isComplete` reste `false` : secrets et mots de passe, détails de sécurité Auth, fichiers binaires, journaux, sauvegardes et données détenues par les prestataires exigent un traitement complémentaire. `structuredDataComplete=true` concerne uniquement les collections explicitement annoncées et effectivement lues.

## Effacement préparé, désactivé

La demande existante reste non destructive. Seules les demandes `requested` et `reviewing` peuvent être préparées par `POST /api/account/erasure` avec `{ "action": "preview" }`. Ce parcours exige identité, origine et corps borné ; il inventorie les données et journalise uniquement les compteurs et codes de blocage, sans contenu, email ni chemin de fichier. Les lignes de journal sont personnelles en lecture RLS ; après une future suppression du compte, leurs références peuvent être détachées, et leur durée de conservation doit être définie.

Le plan contient `dryRun=true`, `deleted=false`, `status=prepared_disabled`. Aucun exécuteur de suppression n’existe dans ce pipeline. Le schéma rejette `execute` et tout champ additionnel ; le préparateur refuse explicitement l’option d’exécution. Il n’existe aucun Cron RGPD.

Les étapes futures restent à vérifier par un opérateur : identité, conservation légale, révocation des sessions et clés API, retrait du consentement, traitement des fichiers via l’API Storage, Vault, Stripe/OpenAI/journaux/sauvegardes, données SQL et enfin Auth. Une équipe encore possédée bloque le traitement jusqu’au transfert explicite ; aucun historique d’un autre membre ne doit être supprimé. Les contraintes d’archives et de preuves doivent être traitées dans une procédure transactionnelle revue avant toute exécution. Ne jamais marquer une demande `completed` sur la base de ce plan.

## Sessions et cache

Le middleware vérifie les sessions avec `getUser`, conserve les cookies rafraîchis et ajoute `Cache-Control: private, no-store` et `Vary: Cookie`. Une indisponibilité du rafraîchissement ne donne aucun droit : les routes réexécutent `requireUser`. Les réponses et erreurs des routes de compte sont également privées et non stockables. Les erreurs SDK ne sont pas exposées.

## Preuves et limites

Les régressions Vitest couvrent pagination réelle, limites/chemins Storage, corps sans `Content-Length`, authentification/origine des routes, erreurs privées, RPC de consentement, dry-run et cache des cookies. Le réseau est bloqué pendant tous les tests unitaires. Les migrations, triggers SQL, permissions, E2E authentifiés et cache réel Cloudflare nécessitent des vérifications distinctes ; les mocks de routes ne prouvent pas les permissions d’une instance distante.
