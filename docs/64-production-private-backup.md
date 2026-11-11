# MentionCheck — PRA Production : restauration native Supabase (projet isolé)

**Décision technique (11 novembre 2026) :** utiliser exclusivement la fonction officielle **Restore to a new project** à partir d'un snapshot PHYSICAL Supabase Pro pour la **base PostgreSQL/Auth**. Les essais expérimentaux de dump local Docker/age, l'exécution PRA sur Cloudflare MediaRunner et la CLI privée Storage sont **abandonnés et retirés de la PR #128**. Les procédures opérationnelles de restauration de schéma synthétique **staging** et de rollback logiciel restent intactes.

**Statut réel au 11/11/2026 : PostgreSQL/Auth restaurés et comparés = PASS ; reprise des octets Storage = BLOCKED ; PRA complet et certification #16 = PARTIAL/NO GO.** Le projet PRA existant `sbquwigqlzfglukxdgau` est ACTIVE_HEALTHY ; les vérifications SQL indépendantes correspondent à Production. Les 13 entrées `storage.objects` du clone sont des **métadonnées**, pas des fichiers restaurés. La PR #128 reste en draft et l'issue #16 ouverte.

## 1. Protection déjà en place et périmètre

- **Source :** `zcztvberuihphqklhjsr` (MentionCheck Production, Supabase Pro, PostgreSQL 17.11, région `eu-central-1`). Deux comptes Auth et profils, deux lignes de quotas, 19 migrations, 28 tables publiques toutes RLS, 13 objets Storage (832 860 octets), trois buckets privés, cinq enregistrements médias SHA-256. Ces chiffres datent d'un relevé **en lecture seule du 11/11/2026** ; les recalculer au moment de l'exercice.
- **Staging :** `ukvgnkxgzyhswgpnvyzz`, version applicative différente, zéro compte client / fichier lors du relevé. **Ne jamais importer un snapshot Production en Staging.**
- **Snapshots fournisseur :** capture exploitant montrant des sauvegardes PHYSICAL le 11/11/2026 à 05:19:11 UTC et le 10/11/2026 à 05:19:32 UTC. Vérifier un snapshot fini dans le Dashboard avant de démarrer. Les sauvegardes Supabase Pro sont quotidiennes, avec **7 jours** de rétention selon la documentation officielle.
- **Copie PRA déjà créée :** `sbquwigqlzfglukxdgau` / `mentioncheck-pra-20261111` (PostgreSQL 17.11, `eu-central-1`). L'opérateur a validé le devis **9,68 USD/mois** affiché par Supabase lors de la création ; la facturation réelle reste à surveiller. Prévoir sa suppression **après** les preuves et le contrôle RGPD, jamais par inadvertance pendant l'exercice.
- **Confidentialité :** les données personnelles restent chez le même fournisseur et dans la région source. Il s'agit néanmoins d'une **nouvelle copie de données réelles** nécessitant accès restreint, durée de conservation définie et nettoyage. Ne jamais publier les noms, chemins Storage, identifiants clients, tokens, logs SQL ni contenu dans ChatGPT/GitHub/CI.

Références officielles : [Restore to a New Project](https://supabase.com/docs/guides/platform/clone-project), [Database Backups](https://supabase.com/docs/guides/platform/backups).

## 2. Procédure opérateur : snapshot Production vers projet distinct

**Exécuté le 11/11/2026 :** le projet `sbquwigqlzfglukxdgau` a été créé par la procédure native Supabase et est `ACTIVE_HEALTHY`. La comparaison SQL en lecture seule sur source et copie montre **13/13 sections de fingerprints agrégés concordants** : `auth.users`, `auth.sessions`, `public.users`, `public.usage_monthly`, `storage.objects`, `storage.buckets`, `public.media_assets`, migrations, policies RLS, flags RLS, fonctions, contraintes et extensions. Totaux égaux : 2 comptes Auth, 8 sessions Auth, 2 profils, 2 quotas, 13 métadonnées objets (832 860 octets référencés), 19 migrations, 28/28 tables publiques RLS, 25 policies, 30 fonctions, 159 contraintes, 6 extensions. Aucun contenu privé n'a été exporté vers GitHub. L'horodatage exact du snapshot restauré demeure **non attesté via le connecteur**. Ceci prouve la **récupération PostgreSQL**, pas la restauration des octets Storage.

*La liste ci-dessous reste une procédure de ré-exécution en cas de nouveau sinistre ; ne pas lancer un deuxième clone de recette pour la certification en cours.*


1. Sur le **projet source Production**, ouvrir [Database → Backups → Restore to a New Project](https://supabase.com/dashboard/project/zcztvberuihphqklhjsr/database/backups/restore-to-new-project). **Ne pas utiliser « Restore » en place** dans les sauvegardes du projet source, ni le connecteur `restore_project(project_id)` dont la cible est le projet lui-même.
2. Choisir **un snapshot PHYSICAL Production existant**, noter uniquement l'horodatage UTC et son état terminé. Le connecteur ChatGPT actuel ne fournit pas le listing natif de ces snapshots ; ne pas inventer de backup ID.
3. Lire le **coût chiffré affiché avant création** ; vérifier qu'il est accepté et que le nouveau projet restera en `eu-central-1`. Le nom doit identifier un exercice PRA isolé, jamais le projet ou le domaine réel.
4. Avant de permettre des connexions clientes, restreindre l'accès au clone. **Toute tâche PostgreSQL, extension, cron, webhook, pg_net, fonction ou connexion sortante susceptible de produire un effet externe doit être identifiée et désactivée dès que la copie est accessible.** La restauration est une copie réelle, pas un environnement synthétique.
5. Déclencher une seule restauration vers le **nouveau projet** par le Dashboard. Vérifier son statut final et noter le **nouveau project_ref**. Le serveur source, les deux clients Solo historiques et les quotas Production ne doivent subir **aucune écriture**.
6. Exécuter seulement des requêtes **agrégées en lecture seule** sur le clone : PostgreSQL 17, comptes `auth.users`, profils, quotas, migrations, tables/contraintes/fonctions, politiques et RLS. Comparer à l'état **de la source lors du snapshot** et non seulement à l'état courant si les données ont changé. Vérifier qu'aucune promotion Solo ni abonnement n'a été déclenché.
7. Préparer un compte de preuve minimal et consigner dans **l'issue #16 existante** : date, backup UTC, project_ref de l'exercice (si approprié), comparaison des comptes/catalogues, PASS/FAIL et tout avertissement sans données personnelles. Le clone n'est pas un environnement commercial.
8. **Ne pas fermer l'issue** avant l'exercice Storage indépendant, les points Auth/RGPD et les autres portes de lancement. Décider explicitement de la suppression du clone après les preuves, puis vérifier sa disparition ; ne pas laisser une copie de production facturée indéfiniment.

**Limites officielles de la duplication :** la base et les comptes Auth peuvent être restaurés, mais **pas les octets des objets Storage, ni les réglages Auth/Edge Functions/API keys/Realtimes/services** sans vérification et reconfiguration indépendantes. Les extensions et tâches SQL dupliquées peuvent aussi initier des appels externes ; il faut les neutraliser.

## 3. Porte indépendante Supabase Storage (13 fichiers au relevé)

**État vérifié au 11/11/2026 :** `verification-media` = **5 objets / 781 559 octets**, `verification-media-derived` = **8 objets / 51 301 octets**, `deal-contracts` = **0 objet**. Trois buckets privés avec leurs métadonnées et politiques RLS présentes dans le clone. **Aucun octet Storage indépendant récupéré et comparé : cette porte reste BLOCKED.**

La restauration PostgreSQL PHYSICAL **n'est pas** une restauration des médias. Réaliser une procédure opérateur **distincte** au moyen des APIs Storage privées officielles : inventaire exact des buckets/objets, export chiffré vers un espace privé contrôlé, puis **upload de tous les octets** vers un Storage de recette indépendant avec service_role exclusivement côté serveur et sans exposition publique. Vérifier la liste complète, les tailles et SHA-256 individuels des octets source et récupérés, les contrôles d'accès des buckets, la cohérence des chemins et les politiques RLS.

**Ne pas coder un nouveau script de copie Client/Storage tant que le service de destination, la méthode privée de transfert, la gestion des secrets et la politique de rétention ne sont pas approuvés.** Aucune donnée réelle ne passe par les workflows GitHub, les conteneurs média ou Staging. Selon le mode de duplication du fournisseur, les métadonnées Storage dans le clone peuvent différer : les inspecter avant toute opération, ne jamais forcer un overwrite/désynchroniser les métadonnées.

### Voie officielle unique sans nouveaux scripts GitHub

L'API **Storage S3** Supabase est compatible avec un client S3 privé tel que **rclone** : [authentification S3](https://supabase.com/docs/guides/storage/s3/authentication), [guide fournisseur de copie S3 → S3](https://supabase.com/docs/guides/self-hosting/copy-from-platform-s3). Pour notre contexte **deux projets Supabase gérés**, reprendre seulement le protocole standard de transfert et **adapter la destination**. Il ne s'agit pas d'un projet self-hosted.

1. L'exploitant sélectionne un **hôte d'exécution privé de confiance** disposant d'une connexion HTTPS aux deux endpoints S3. Les connecteurs Supabase disponibles ici ne disposent ni d'action de téléchargement/upload des objets, ni d'identifiants S3, ni de runtime privé capable de transférer leurs octets.
2. Configurer **hors GitHub/CI/chat** deux accès S3 distincts : source Production en **lecture seule opérationnelle** (les clés S3 techniques générées dans le Dashboard sont cependant **plein privilège, contournent RLS**, et ne doivent pas être considérées comme de vraies clés limitées), et destination clone. Les garder en gestionnaire de secrets ; définir une fenêtre d'utilisation courte et **révoquer les clés après la preuve**. Ne jamais déposer de clé Production dans le projet PRA ou dans une fonction publique.
3. Ne pas envoyer directement les fichiers dans les **13 clés préexistantes** du clone : ses métadonnées ont été copiées par le snapshot et les octets absents peuvent provoquer un conflit ou une réconciliation dangereuse. Démarrer par une destination **Storage isolée privée** dédiée à la vérification, au sein du projet PRA, puis valider avant de concevoir un éventuel cutover réel des noms d'origine.
4. Récupérer **les octets** des 13 fichiers depuis la source via l'API S3 ou Storage privée, les transférer au stockage indépendant, puis **relire chaque objet à destination** et comparer un **SHA-256 calculé sur ses octets** au SHA-256 calculé sur la source au même instant. Contrôler également 13/13, 832 860 octets attendus à l'instant de référence (ou inventaire source recalculé si évolution), les types MIME, chemins et restrictions d'accès. Comparer les cinq SHA media préexistants **en complément**, jamais à la place des 13.
5. Ne publier dans l'issue #16 **que** le nombre d'objets concordants, le nombre d'octets, la confirmation 13/13 SHA-256, le statut des contrôles privés/RLS, les horodatages et la preuve de nettoyage, **sans noms, tokens ni empreintes personnelles**.
6. Après validation, supprimer et vérifier la disparition **des copies temporaires seulement**, révoquer les clés S3 temporaires, puis programmer explicitement la suppression du projet PRA quand toutes les portes de certification seront closes.

**Garde-fou :** le plugin Supabase actuel ne peut pas exécuter cette copie binaire. N'inventer ni contrôle SHA-256 ni upload ; l'existence des 13 lignes `storage.objects` n'est **pas** un test positif. La limitation doit être levée par un opérateur sur environnement privé avant la certification complète.

Preuve actuelle : `SQL_RESTORE_VERIFIED=true` pour PostgreSQL/Auth (comparaison SQL sur clone réel), `STORAGE_BINARY_RESTORE_VERIFIED=false` (pas d'octets relus), `FULL_PRA_CERTIFIED=false`. **P0-B reste PARTIAL avec porte Storage BLOCKED ; pas de GO commercial.**

## 4. Autres portes à préserver

- **P0-C Solo :** ne pas appliquer les migrations en Production ni activer le délai promotionnel 30 jours des **deux comptes existants** avant le GO explicite.
- **Sécurité :** protection des mots de passe compromis actuellement signalée désactivée dans Supabase Auth ; cinq fonctions `SECURITY DEFINER` accessibles à `authenticated` à examiner et six tables RLS sans policy (fermées par défaut) à vérifier.
- **RGPD :** vérifier l'effacement réel de la copie après test, la rétention des snapshots, la suppression des fichiers de récupération et les effets fournisseurs ; un test synthétique staging n'y suffit pas.
- **Commercial :** pas de paiement Stripe Live, pas de migration Production, pas de déploiement Worker et pas d'appel API OpenAI payant dans le seul cadre du PRA.

## 5. Historique des essais abandonnés

Retirés de la PR #128 : `production-private-backup.sh`, `production-private-storage.mjs`, `production-private-backup.test.ts`, `pra-storage.mjs`, `pra-storage-run.mjs`, `pra-storage.test.mjs`. Aucun de ces composants n'était sur `main` ni activé comme service en Production. Les anciens essais n'ont **jamais** restauré la Production ou les 13 objets réels ; les anciennes preuves restent dans l'historique de l'issue #16, mais ne constituent plus la procédure recommandée.

**PRA full restore = BLOCKED jusqu'à preuve réelle.** Voir [issue #16](https://github.com/totorina47501-wq/Project3/issues/16) et [PR #128](https://github.com/totorina47501-wq/Project3/pull/128).
