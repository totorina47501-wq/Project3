# Runner média dans le compte Cloudflare existant

## Déploiement autorisé

Le 5 novembre 2026, l’utilisateur confirme son forfait Cloudflare payé et
autorise son utilisation. Le déploiement passe par la connexion Workers Builds
déjà liée à `main`, sans extraire de clé Cloudflare ou Supabase du Worker.

La configuration principale conserve `keep_vars=true` et le script de
déploiement OpenNext conserve `--keep-vars`. Les seuls nouveaux `vars` sont
`MEDIA_JOBS_SCHEMA_READY=true`, `MEDIA_PROCESSING_ENABLED=true` et
`MEDIA_CLOUDFLARE_RUNNER_ENABLED=true`. Ils activent intentionnellement les
fonctionnalités dont les migrations ont déjà été appliquées.

Le point d’entrée personnalisé conserve le handler et les exports OpenNext,
puis exporte `MediaRunner`. Wrangler configure le binding interne `MEDIA_RUNNER`,
le stockage SQLite de l’objet et l’image Docker du runner existant. La politique
`default` permet de borner `max_instances=1` et `instance_type=basic` (1 Gio,
1/4 vCPU), avec `constraints.jurisdiction=eu`. Les previews de versions sont
désactivées, les Workers qui implémentent des Durable Objects n’en disposant pas.
Les conteneurs de développement local restent désactivés.

Aucun autre hébergeur, aucune nouvelle souscription, aucun appel OpenAI,
paiement Stripe, email ou suppression Storage n’est ajouté.

## Déclenchement et coûts

1. La route authentifiée `/api/media/jobs` vérifie l’origine et les propriétés,
   puis utilise la même RPC SQL d’enqueue. Une notification interne planifie
   l’alarme du singleton ; aucune URL publique n’expose son démarrage.
2. L’alarme lit les jobs actifs via l’API Supabase et les secrets serveur du
   Worker. Une file vide laisse le conteneur arrêté et supprime l’alarme.
3. Un job disponible démarre une seule instance. Le conteneur reçoit uniquement
   URL/clé Supabase et flags techniques ; aucune clé OpenAI ou Stripe.
4. `MEDIA_RUNNER_ONCE=true` termine après un essai. Le téléchargement, SHA-256,
   décodage, publication/relecture et finalisation CAS sont ceux du pipeline existant.
5. L’objet contrôle le processus toutes les 15 secondes pendant son exécution.
   Watchdog à 270 secondes et timeout natif d’inactivité ; les sources et sorties
   durables restent dans Supabase, pas sur le disque éphémère.
6. Les retries respectent `available_at` et `lease_until`. Il n’y a pas de cron
   qui garde une instance à vide. Au-delà de 60 démarrages/heure, la file attend
   l’heure suivante. Après cinq échecs consécutifs de lecture, une nouvelle
   notification utilisateur est nécessaire.

Ces bornes limitent l’usage ; elles ne constituent pas un plafond monétaire.
Les quotas inclus et dépassements du forfait Cloudflare du compte s’appliquent.
Le budget natif protège aussi un objet évincé pendant le traitement. Une tentative
interrompue reste reprise par les baux SQL ; des sorties privées orphelines
peuvent subsister comme décrit dans le guide du transport.

## Statut et arrêt

`GET /api/media/jobs` reste privé et renvoie aussi `runner` avec `configured`,
`running`, `phase` et un code d’erreur minimisé. Aucun secret, URL signée ou
message SDK n’est retourné. La lecture peut renotifier un job du propriétaire
encore actif si la notification initiale a échoué.

Mettre `MEDIA_RUNNER_PAUSED=true` dans les variables runtime du Worker pour
fermer les nouvelles préparations et arrêter le conteneur à l’alarme suivante.
Ce flag n’est pas déclaré dans les vars Wrangler et est conservé au déploiement.
Cela ne supprime aucun média ni aucune preuve.

Les déploiements Worker et image ne sont pas transactionnels. Workers Builds
peut mettre le Worker à jour puis échouer sur l’image. Vérifier le déploiement
complet et une extraction réelle avant d’annoncer le service opérationnel.
Si le compte n’a pas les droits Containers ou si le forfait payé ne couvre
pas Workers Paid, ne pas créer d’abonnement supplémentaire automatiquement.

## Références techniques vérifiées

- [Cloudflare : déployer depuis Workers Builds](https://developers.cloudflare.com/containers/guides/deploy/)
- [API native Durable Object Container](https://developers.cloudflare.com/containers/api/durable-object-container/)
- [Variables et secrets au démarrage](https://developers.cloudflare.com/containers/examples/env-vars-and-secrets/)
- [Placement UE](https://developers.cloudflare.com/containers/concepts/placement/)
- [Worker personnalisé OpenNext](https://opennext.js.org/cloudflare/howtos/custom-worker)

## Recette

Les tests locaux simulent l’API native et exercent file vide, démarrage différé,
réservation active, coupe-circuit, watchdog, budget et erreurs. Ils ne remplacent
pas le déploiement. La CI construit et recettait déjà l’image sans réseau.
Après publication : contrôler les checks Workers Builds, soumettre uniquement
des médias synthétiques avec le compte technique isolé, vérifier les artefacts
et références SQL, l’arrêt à vide puis désactiver le compte et expirer ses sessions.
Aucune suppression de production n’est nécessaire à cette recette.

## Vérifications avant publication

265 tests unitaires (62 fichiers), 72 tests médias, 8 suites SQL locales,
4 tests du harnais SQL, 7 RGPD, 22 préparation IA et 6 fixtures HTTP réussis.
Playwright : 21 réussis et 1 ignoré. TypeScript, lint, build Next.js,
bundle OpenNext et `wrangler deploy --dry-run --containers-rollout=none`
réussis. Ce dry-run confirme le bundle et les bindings, pas le déploiement
ou l’extraction réelle ; leur résultat doit être contrôlé après publication.
