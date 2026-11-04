# Pipeline média local avec file persistante

Le runner `workers/media-jobs/src/queue-runner.mjs` réserve un travail puis appelle **l'exécuteur existant** `runMediaJob`. Celui-ci copie les sources locales, vérifie leurs SHA-256 et les sorties Sharp/FFmpeg, publie atomiquement et permet une reprise idempotente. Aucun port, fournisseur IA, crédit, compte ou service n'est ouvert.

`runQueuedMediaJob({queue,workerId,inputRoot,outputRoot,signal,pollMs:100})` traite au maximum un travail. Les deux racines doivent exister. Les chemins de `payload.inputs` sont relatifs à `inputRoot` et chaque SHA-256 est obligatoire. Le payload suit le manifeste schemaVersion 1 de l'exécuteur. Les chemins de stockage doivent donc correspondre aux fichiers locaux préalablement disponibles ; aucun téléchargement réseau implicite n'existe.

Le contrat injecté est :

- `claim(workerId)` → `null` ou `{id,leaseToken,job}` ; `job.id === id`.
- `complete(id,leaseToken,result)` → booléen de CAS ; reçoit uniquement `runMediaJob(...).result`, jamais le chemin absolu local.
- `fail(id,leaseToken,code)` → booléen de CAS ; la base décide du retry, de ses limites et de l'état terminal.
- `isCancelled(id,leaseToken)` → booléen ; vrai si annulé, bail expiré ou propriétaire remplacé.

Le résultat du runner est `{state,id?,code?}` avec `idle`, `completed`, `failed`, `cancelled` ou `stale`. Un refus CAS reste `stale`, même si des sorties locales valides existent. Une nouvelle réservation peut réutiliser ces sorties après revalidation. Un signal d'annulation ou une erreur de lecture de l'état arrête le sous-processus ; aucun succès base n'est déclaré sans CAS. Une défaillance du transport de file peut rejeter la promesse : le bail assure alors la récupération. Le runner ne prolonge pas les baux ; leur durée doit dépasser le timeout maximal de 120 secondes et le temps de validation/publication. Le crash matériel nécessite la récupération explicite des verrous locaux décrite dans le README worker avant reprise.

`createLocalSqlMediaQueue(db)` dans `src/sql-queue.mjs` est un adaptateur de harness local, compatible avec `db.query` PGlite. Il utilise des paramètres SQL pour :

- `public.media_job_claim(worker UUID)` → lignes `id, lease_token, payload` ;
- `public.media_job_finish(id UUID, token UUID, result JSONB)` → booléen ;
- `public.media_job_fail(id UUID, token UUID, code TEXT)` → booléen ;
- l'état de `public.media_processing_jobs` pour vérifier `processing`, token et `lease_until > now()`.

Les fonctions SQL restent responsables de l'autorisation, des reprises, de l'annulation et des transitions persistantes. Le traitement technique ne produit ni transcription, ni analyse Vision, ni score IA. Les règles textuelles serveur restent distinctes des preuves techniques.

Vérification locale, sans réseau :

```sh
npm run test:media-jobs:offline
```

Les tests synthétisent de vraies images Sharp et une vidéo FFmpeg, contrôlent les hashes obligatoires, le CAS refusé, la reprise, l'annulation active et l'adaptateur SQL. `sql-pipeline.test.mjs` charge toutes les migrations réelles via le même harnais PostgreSQL, puis traite et archive réellement un carrousel et une vidéo. Auth/Storage sont simulés, pgvector est explicitement omis.

## Persistance et accès applicatif

La migration additive `20261104225500_media_processing_queue.sql` ajoute les
jobs et leurs sources référencées. Elle n’a été appliquée que dans les bases
locales jetables. Le CLI Supabase n’a pas pu créer le fichier automatiquement
dans cet environnement (son répertoire utilisateur est en lecture seule) ;
le fichier versionné a donc été créé localement puis exercé par le harnais.
Aucune migration distante ni fonction planifiée n’a été exécutée.

Le serveur déduit les sources depuis des lignes `media_assets` confirmées,
possédées et non expirées avec SHA-256 persisté. Une vidéo ou 2–5 images du
même groupe sont acceptées, dans l’ordre choisi. L’empreinte combine sources,
légende, plateforme et version : une demande identique reprend le même job.
Huit jobs actifs maximum par compte. Une réservation dure cinq minutes, avec
jeton renouvelé et trois tentatives maximum, espacées après un échec rejouable.
Une source invalide ou un résultat technique malformé ne devient pas une preuve.

`POST /api/media/jobs` expose `enqueue` et `cancel`, après origine/session,
lecture du corps bornée et limitation des écritures. Les scores viennent des
règles serveur, pas du navigateur. `GET` liste uniquement les jobs du compte,
20 par page, sans jeton de bail. Les RPC de mutation/claim sont exclusivement
accordées au rôle serveur. RLS protège aussi les lectures directes.

Après succès, le résultat technique et un SHA-256 du manifeste enrichi sont
archivés avec la vérification. Le score concerne seulement la légende ; les
warnings `rules_only` disent explicitement que les images/audio ne sont ni
analysés par IA ni transcrits. Les références SQL protègent toutes les sources
d’un carrousel, pas seulement sa première image. Les gardes de suppression et
de rétention consultent aussi ces références quand le schéma est déclaré prêt.

`MEDIA_JOBS_SCHEMA_READY=false` et `MEDIA_PROCESSING_ENABLED=false` restent
les défauts. Avant une activation future : appliquer et vérifier la migration,
la persistance des hashes, puis valider l’hôte d’exécution isolé. Déclarer le
schéma prêt seulement après cette recette. Conserver `SCHEMA_READY=true` si le
traitement est ensuite désactivé, pour protéger les sources déjà référencées.
La bibliothèque masque les commandes actives tant que les deux flags ne sont
pas vrais. Aucun flag distant n’a été changé par ce lot.

Les sorties restent dans les racines locales de l’exécuteur. Leur transport
vers un stockage distant, son chiffrement/conservation, le déploiement d’un
runner continu et sa supervision ne sont pas activés. L’archive SQL prouve ce
que le worker a déclaré et vérifié localement ; elle n’est ni une signature
qualifiée, ni une garantie de disponibilité distante des fichiers dérivés.
