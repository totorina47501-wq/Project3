# MentionCheck — PRA Production : restauration native Supabase (projet isolé)

**Décision technique (11 novembre 2026) :** utiliser exclusivement la fonction officielle **Restore to a new project** à partir d'un snapshot PHYSICAL Supabase Pro pour la **base PostgreSQL/Auth**. Les essais expérimentaux de dump local Docker/age, l'exécution PRA sur Cloudflare MediaRunner et la CLI privée Storage sont **abandonnés et retirés de la PR #128**. Les procédures opérationnelles de restauration de schéma synthétique **staging** et de rollback logiciel restent intactes.

**Statut : préparation / BLOCKED.** Aucun nouveau projet créé, aucun snapshot restauré, aucun objet Storage binaire récupéré sur une destination indépendante. La PR #128 reste draft et l'issue #16 ouverte. Une sauvegarde fournisseur visible ou une CI verte ne suffit pas à certifier la restauration réelle.

## 1. Protection déjà en place et périmètre

- **Source :** `zcztvberuihphqklhjsr` (MentionCheck Production, Supabase Pro, PostgreSQL 17.11, région `eu-central-1`). Deux comptes Auth et profils, deux lignes de quotas, 19 migrations, 28 tables publiques toutes RLS, 13 objets Storage (832 860 octets), trois buckets privés, cinq enregistrements médias SHA-256. Ces chiffres datent d'un relevé **en lecture seule du 11/11/2026** ; les recalculer au moment de l'exercice.
- **Staging :** `ukvgnkxgzyhswgpnvyzz`, version applicative différente, zéro compte client / fichier lors du relevé. **Ne jamais importer un snapshot Production en Staging.**
- **Snapshots fournisseur :** capture exploitant montrant des sauvegardes PHYSICAL le 11/11/2026 à 05:19:11 UTC et le 10/11/2026 à 05:19:32 UTC. Vérifier un snapshot fini dans le Dashboard avant de démarrer. Les sauvegardes Supabase Pro sont quotidiennes, avec **7 jours** de rétention selon la documentation officielle.
- **Budget :** le connecteur Supabase renvoie un coût de base de **10 USD/mois pour un projet additionnel** dans l'organisation actuelle. **Ce devis n'est pas le prix final du clone** : Supabase reproduit aussi les ressources et affiche le montant effectif avant validation. Aucune dépense n'est déclenchée sans confirmation explicite du devis.
- **Confidentialité :** les données personnelles restent chez le même fournisseur et dans la région source. Il s'agit néanmoins d'une **nouvelle copie de données réelles** nécessitant accès restreint, durée de conservation définie et nettoyage. Ne jamais publier les noms, chemins Storage, identifiants clients, tokens, logs SQL ni contenu dans ChatGPT/GitHub/CI.

Références officielles : [Restore to a New Project](https://supabase.com/docs/guides/platform/clone-project), [Database Backups](https://supabase.com/docs/guides/platform/backups).

## 2. Procédure opérateur : snapshot Production vers projet distinct

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

La restauration PostgreSQL PHYSICAL **n'est pas** une restauration des médias. Réaliser une procédure opérateur **distincte** au moyen des APIs Storage privées officielles : inventaire exact des buckets/objets, export chiffré vers un espace privé contrôlé, puis **upload de tous les octets** vers un Storage de recette indépendant avec service_role exclusivement côté serveur et sans exposition publique. Vérifier la liste complète, les tailles et SHA-256 individuels des octets source et récupérés, les contrôles d'accès des buckets, la cohérence des chemins et les politiques RLS.

**Ne pas coder un nouveau script de copie Client/Storage tant que le service de destination, la méthode privée de transfert, la gestion des secrets et la politique de rétention ne sont pas approuvés.** Aucune donnée réelle ne passe par les workflows GitHub, les conteneurs média ou Staging. Selon le mode de duplication du fournisseur, les métadonnées Storage dans le clone peuvent différer : les inspecter avant toute opération, ne jamais forcer un overwrite/désynchroniser les métadonnées.

Preuve exigée : `SQL_RESTORE_VERIFIED=true` seulement **après exercice réel** sur un projet indépendant ; `STORAGE_BINARY_RESTORE_VERIFIED=true` seulement **après récupération et relecture des octets** dans une destination indépendante. En cas d'échec sur une des deux portes : **P0-B BLOCKED**, pas de GO commercial.

## 4. Autres portes à préserver

- **P0-C Solo :** ne pas appliquer les migrations en Production ni activer le délai promotionnel 30 jours des **deux comptes existants** avant le GO explicite.
- **Sécurité :** protection des mots de passe compromis actuellement signalée désactivée dans Supabase Auth ; cinq fonctions `SECURITY DEFINER` accessibles à `authenticated` à examiner et six tables RLS sans policy (fermées par défaut) à vérifier.
- **RGPD :** vérifier l'effacement réel de la copie après test, la rétention des snapshots, la suppression des fichiers de récupération et les effets fournisseurs ; un test synthétique staging n'y suffit pas.
- **Commercial :** pas de paiement Stripe Live, pas de migration Production, pas de déploiement Worker et pas d'appel API OpenAI payant dans le seul cadre du PRA.

## 5. Historique des essais abandonnés

Retirés de la PR #128 : `production-private-backup.sh`, `production-private-storage.mjs`, `production-private-backup.test.ts`, `pra-storage.mjs`, `pra-storage-run.mjs`, `pra-storage.test.mjs`. Aucun de ces composants n'était sur `main` ni activé comme service en Production. Les anciens essais n'ont **jamais** restauré la Production ou les 13 objets réels ; les anciennes preuves restent dans l'historique de l'issue #16, mais ne constituent plus la procédure recommandée.

**PRA full restore = BLOCKED jusqu'à preuve réelle.** Voir [issue #16](https://github.com/totorina47501-wq/Project3/issues/16) et [PR #128](https://github.com/totorina47501-wq/Project3/pull/128).
