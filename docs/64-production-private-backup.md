# MentionCheck — sauvegarde PostgreSQL Production privée et restauration isolée

**Statut : SUPABASE PRO CONFIRMÉ ; SNAPSHOTS PHYSICAL VISIBLES DANS LE DASHBOARD LE 11/11 ; RESTAURATION ISOLÉE NON VALIDÉE ; EXPORT PRIVÉ PRODUCTION NON RÉALISÉ.** Seul le propriétaire d'un poste de confiance avec le mot de passe PostgreSQL peut exécuter cette procédure. Aucune sauvegarde réelle ne doit être communiquée dans ChatGPT, commitée dans GitHub, envoyée dans les logs CI ou copiée vers Supabase Staging.

## Périmètre vérifié le 11 novembre 2026

- Supabase **Production** : projet `zcztvberuihphqklhjsr`, PostgreSQL **17.11**, organisation Supabase **Pro** depuis le 11 novembre 2026 (**forfait vérifié via connecteur Supabase**). 2 comptes Auth, 2 profils app, 2 lignes de quotas mensuels, 0 souscription Stripe, 13 objets Storage, 3 buckets ; taille PostgreSQL 14 Mo lors du préflight en lecture seule.
- Supabase **Staging** : projet `ukvgnkxgzyhswgpnvyzz` ; **ne jamais** y importer ni restaurer une sauvegarde production, même temporairement.
- Le plan **Pro** fournit des sauvegardes automatiques PostgreSQL quotidiennes (7 jours de rétention), **et des sauvegardes PHYSICAL sont désormais visibles sur la capture transmise par l'exploitant le 11/11/2026** : le connecteur Supabase ne permet toujours pas de les lister ni de démontrer leur restauration. Vérifier un backup terminé et sa date dans le [Dashboard Backups Production](https://supabase.com/dashboard/project/zcztvberuihphqklhjsr/database/backups/scheduled). L'export privé CLI reste recommandé pour un secours hors site (rôles + schéma + données). Les **octets des objets Storage ne sont pas inclus** : backup et restauration séparée des 13 objets. La certification de restauration complète reste **BLOCKED** jusqu'aux preuves réelles, et non seulement au passage sur Pro.
- Le script préparé dans la PR #128 est `scripts/recette/production-private-backup.sh`. **Aucun workflow GitHub n'exécute ce script**, et celui-ci interdit volontairement GitHub Actions/CI.
- Documentation fournisseur : [Supabase Backups](https://supabase.com/docs/guides/platform/backups) et [CLI Backup/Restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

## Inventaire sauvegardes fournisseur — preuve visuelle du 11/11/2026

**Preuve visuelle fournie par l'exploitant le 11/11/2026 à 12:05 (Europe/Paris) :** l'onglet Supabase Production `Database Backups > Scheduled backups` liste des snapshots **PHYSICAL** datés du **11/11/2026 à 05:19:11 UTC** et du **10/11/2026 à 05:19:32 UTC**, ainsi que plusieurs jours antérieurs ; un bouton `Restore` apparaît sur les entrées. Cette preuve confirme la **présence dans le Dashboard** de sauvegardes physiques accessibles à la restauration. Elle ne prouve ni une restauration réussie, ni l'intégrité complète du contenu, ni une protection des octets Storage. Aucune restauration production n'a été lancée.

La méthode officielle [Restore to a new project](https://supabase.com/docs/guides/platform/clone-project) crée un projet indépendant **avec frais mensuels supplémentaires** et copie les données PostgreSQL, mais pas les octets Storage. Aucun clonage ne doit être lancé sans revue du montant annoncé et autorisation explicite. Cette copie ne doit jamais être confondue avec un test sur le projet Production ; arrêter les cron/webhooks/connexions externes sur la copie avant tout essai. **Le jalon `backup_present` est documenté ; `isolated_restore_verified` reste non validé.**

## Contrôle immédiat de la sauvegarde fournisseur Pro

Ouvrir [Database → Backups → Scheduled](https://supabase.com/dashboard/project/zcztvberuihphqklhjsr/database/backups/scheduled) et relever uniquement **statut final, date UTC et ID/horodatage non sensible** d'une sauvegarde terminée. Si aucune sauvegarde n'apparaît juste après l'upgrade, ne pas affirmer qu'elle existe. Cette vérification ne lance aucune restauration ni écriture, et ne peut actuellement pas être effectuée par le connecteur Supabase disponible dans ChatGPT. Même après un backup présent, exiger une restauration **isolée** et la copie des octets Storage avant GO.

## 1. Préparer le poste de confiance (hors GitHub, hors chat)

Installer **Supabase CLI**, **Docker local**, **age + age-keygen**, **Node.js**, `tar` et `sha256sum`. Inspecter les commandes avec `supabase db dump --help` et `docker context inspect default`. Le disque contenant les fichiers SQL temporaires doit être **chiffré** ; sinon **ne pas lancer l'export**. Les fichiers SQL en clair sont détruits du répertoire temporaire en sortie de script, mais l'effacement sécurisé de blocs SSD n'est pas garanti.

Créer la clé privée `age` sur ce poste, la sauvegarder **hors ligne séparément** et ne jamais la déposer dans la base, le dépôt ou un service de chat :

```sh
mkdir -p "$HOME/.local/share/mentioncheck-secret"
chmod 700 "$HOME/.local/share/mentioncheck-secret"
age-keygen -o "$HOME/.local/share/mentioncheck-secret/backup-age-key.txt"
chmod 600 "$HOME/.local/share/mentioncheck-secret/backup-age-key.txt"
mkdir -p "$HOME/mentioncheck-encrypted-backups" "$HOME/mentioncheck-private-work"
chmod 700 "$HOME/mentioncheck-encrypted-backups" "$HOME/mentioncheck-private-work"
```

**Important :** ces deux dossiers ne doivent pas être situés dans un dépôt Git, et le dossier de travail doit être sur un **volume local chiffré**. Si l'identité `age` existe déjà, la conserver : ne pas générer une nouvelle clé qui rendrait les archives antérieures illisibles.

## 2. Exporter avec une connexion production en TLS (lecture seule logique)

Sur le Dashboard Supabase Production, **Connect** permet de récupérer le DSN PostgreSQL direct ou Session pooler : [projet de production](https://supabase.com/dashboard/project/zcztvberuihphqklhjsr). Le mot de passe de connexion est un secret de base PostgreSQL, **pas** la clé `sb_secret_`. Ne pas envoyer le DSN ici. Le script refuse un DSN staging, un pooler transactionnel 6543, tout DSN hors production ou sans `sslmode=require`.

Exécuter **depuis le poste de confiance** (le shell doit déjà disposer d'une URL de production remplie en privé) :

```sh
export MC_BACKUP_DIR="$HOME/mentioncheck-encrypted-backups"
export MC_BACKUP_WORKDIR="$HOME/mentioncheck-private-work"
export MC_BACKUP_AGE_IDENTITY="$HOME/.local/share/mentioncheck-secret/backup-age-key.txt"

# Renseigner MENTIONCHECK_PROD_POSTGRES_URL en privé depuis Supabase Connect,
# avec sslmode=require (ne jamais l'écrire dans Git, chat ou historique shell).
read -rs -p "URL PostgreSQL Production (TLS): " MENTIONCHECK_PROD_POSTGRES_URL
printf '\n'
export MENTIONCHECK_PROD_POSTGRES_URL
bash scripts/recette/production-private-backup.sh --backup
unset MENTIONCHECK_PROD_POSTGRES_URL
```

Le script utilise la **CLI Supabase officielle** pour exporter les rôles, le schéma, les données et l'historique des migrations ; chiffre une archive avec `age` ; vérifie qu'elle peut être déchiffrée et que les octets correspondent ; ne conserve que `*.tar.age` et son SHA-256. Aucun chemin de sortie ne doit pointer dans Git. L'intégrité cryptographique **ne prouve pas** la restauration SQL : la prochaine étape est obligatoire.

## 3. Restaurer sur une instance locale jetable, jamais sur staging/prod

Déchiffrer l'archive en mémoire / volume local chiffré, sous répertoire `chmod 700`, et créer un projet Supabase **local neuf** avec `supabase init` puis `supabase start`, sur Docker **local** et sans accès public. La base cible doit être une instance distincte ne contenant aucune donnée importante.

```sh
# Sur le poste privé, avec chemin de l'archive validée.
mkdir -p "$HOME/mentioncheck-private-work/restore"
chmod 700 "$HOME/mentioncheck-private-work/restore"
age -d -i "$MC_BACKUP_AGE_IDENTITY" "$MC_ENCRYPTED_ARCHIVE" \
  | tar -x -C "$HOME/mentioncheck-private-work/restore"
# Instancier le Supabase local jetable dans un autre dossier :
mkdir -p "$HOME/mentioncheck-private-work/local-supabase"
(cd "$HOME/mentioncheck-private-work/local-supabase" && supabase init --yes && supabase start)
```

Après le démarrage de Supabase local, utiliser la commande suivante **uniquement** sur le port local `54322` (aucun DSN Production ou staging dans cette étape) :

```sh
export MC_RESTORE_DIR="$HOME/mentioncheck-private-work/restore"
export MC_LOCAL_POSTGRES="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
psql "$MC_LOCAL_POSTGRES" --single-transaction --set ON_ERROR_STOP=1 \
  --file "$MC_RESTORE_DIR/roles.sql" \
  --file "$MC_RESTORE_DIR/schema.sql" \
  --command 'SET session_replication_role = replica' \
  --file "$MC_RESTORE_DIR/data.sql"
# Restaurer l'historique seulement si le schéma supabase_migrations cible
# existe et l'opération est compatible ; ne pas écraser des lignes existantes.
psql "$MC_LOCAL_POSTGRES" --set ON_ERROR_STOP=1 \
  -c "select count(*) from auth.users;" \
  -c "select count(*) from public.users;" \
  -c "select count(*) from public.usage_monthly;" \
  -c "select count(*) from storage.objects;"
```

En cas de conflit sur un rôle ou une table préinstallée, le test **échoue** : ne pas supprimer d'objet distant, ni contourner `ON_ERROR_STOP`. Le SQL de restauration local et le versionnement du catalogue doivent être réconciliés avant de pouvoir annoncer une sauvegarde restaurable.

Sur le **seul PostgreSQL LOCAL**, exécuter la restauration documentée par Supabase (rôles → schéma → données) avec `psql --single-transaction --set ON_ERROR_STOP=1`; la session des données nécessite `SET session_replication_role=replica` pour éviter les triggers de doublon. Si la restauration échoue à cause d'un rôle, d'une extension, d'une table gérée Auth ou d'une incompatibilité de version PG17, **ne pas modifier production** ni ignorer l'erreur. Corriger seulement l'environnement local jetable et consigner le résultat. Ne jamais utiliser les commandes `restore_project`, `db reset`, `db push` ou `pg_restore --clean` vers le projet distant.

Vérifications attendues **dans la base restaurée locale** : `auth.users` = 2, `public.users` = 2, `usage_monthly` = 2, `subscriptions` = 0, table de promotions absente avant cutover. Comparer les comptes agrégés avec un nouveau préflight source en lecture seule, sans écrire d'identifiants, emails, secrets ou dump dans les logs. Vérifier tables, fonctions, RLS, contraintes, extensions et migrations restaurées. Détruire ensuite tout le laboratoire local et les fichiers temporaires en clair, en gardant seulement le chiffré et la clé privée hors site.

> **Pas de déclaration de PASS avant restauration réellement exécutée et comparaison.** La CI des tests synthétiques déjà existante ne constitue pas une sauvegarde de production.

## 4. Supabase Storage (13 objets) — porte séparée obligatoire

Le dump PostgreSQL exporte les métadonnées dans `storage.objects`, **pas les octets binaires**. L'opérateur doit réaliser un inventaire privé des 13 chemins dans les 3 buckets, exporter chaque objet avec une méthode Storage API sûre sur le même poste privé, conserver les chemins et empreintes SHA-256 dans une archive chiffrée séparée, puis restaurer les objets dans un environnement local isolé et comparer leurs empreintes. Ne pas publier le contenu des médias ni leurs noms clients.

**Si les objets ne sont pas protégés et restaurables, la certification sauvegarde complète reste PARTIAL**, même avec un PostgreSQL restauré.

## 5. Preuve de clôture P0-C / issue #16

Ne publier dans [l'issue #16](https://github.com/totorina47501-wq/Project3/issues/16) **que** les métadonnées non sensibles : date UTC, durée, versions CLI/Postgres, SHA du code, checksum de l'archive chiffrée, nombre de tables, counts agrégés, verdict restauré PASS/FAIL, couverture Storage, emplacement privé de la copie hors site (sans révéler son chemin si personnel). Ne jamais publier SQL, données, URL PostgreSQL, mot de passe ou clé `age`.

**Ensuite seulement** : préparer le cutover **transactionnel unique** quotas + promotions + bridge + deux attributions `activation_pending` en production, avec rollback. Les 30 jours de Solo ne commenceront qu'au **GO commercial explicite** ; `BILLING_ENABLED=false` et Stripe Live restent désactivés.

## Relevé opérationnel complémentaire — 11 novembre 2026

- **État Production relu par SQL en lecture seule :** 2 comptes Auth, 2 profils, 2 lignes de quota, 0 abonnement Stripe actif, **13 objets Storage dans 3 buckets**, `promotional_solo_access` absente. Staging : 0 compte/objet, table promotion présente. Aucune modification de données.
- **Preuve backup fournisseur** : les snapshots physiques du 11/11 à 05:19:11 UTC et du 10/11 à 05:19:32 UTC sont visibles sur une capture exploitant déjà documentée. **Le connecteur Supabase ne peut pas actualiser la liste des backups** ; ne pas déclarer un nouveau snapshot vérifié par API ou une restauration PASS.
- **Prix nouveau projet** : le connecteur Supabase `get_cost(project, org)` a renvoyé **10 USD/mois**, comme tarif de création indicative. La fonctionnalité officielle « Restore to a New Project » réplique les ressources de la source et affiche une estimation de frais propre à l'opération. **Le coût réel affiché avant confirmation doit être approuvé explicitement par l'exploitant. Aucun clone commandé ou payé.**
- **Mécanismes externes** : le catalogue PostgreSQL de la Production indique 0 extension `pg_net` ou `pg_cron` installée au moment du contrôle. Cela ne suffit **pas** à exclure tout webhook, job, intégration serveur ou envoi sortant. Avant toute restauration indépendante, inventorier et neutraliser ces chemins sur la copie, sans laisser les données clients accéder à un service tiers.
- **Statut** : `backup_present` documenté via capture, `isolated_restore_verified=false`, `storage_binary_restore_verified=false`. La migration Producton Solo reste bloquée ; ne pas déplacer de données vers Staging ni vers GitHub.
