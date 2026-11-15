# MentionCheck — AI Harness d'exécution GitHub V1 (15 novembre 2026)

## Comportement confirmé par le dépôt

Le dispatcher Codex (3 places), le dispatcher Copilot (4 places), les workflows de fusion très limitée et la CI existent **déjà**. On ne crée pas de nouveaux agents ni de moteurs concurrents. Les PR d'agents peuvent déclencher `action_required` sans aucun job ; la correction manuelle de la branche utilisée précédemment ne doit plus être la voie nominale.

## Nouveau `mentioncheck-ci-auto-recovery.yml`

- Exécuté **depuis `main` de confiance**, sur fin de CI, deux fois par heure et à la demande ; aucune checkout de PR avec jeton d'écriture.
- Uniquement PR ouvertes **du même dépôt**, base `main`, branche Codex/Copilot, issue ouverte et explicitement confiée à un agent.
- Exclut les issues en pause, avec `release:evidence-required`, `security:manual`, `do-not-merge`, `legal:blocked`, `billing:blocked`, ainsi que les PR modifiant des workflows, des configurations Cloudflare, des variables d'environnement ou le préflight de production.
- Si CI `action_required` avec **zéro job**, dispatch de `ci.yml` sur la branche exacte **une fois au maximum par SHA**. La CI est en lecture seule, sans appel IA/Stripe/production ; CI authentifiée sur le dernier SHA obligatoire.
- Si échec réel limité aux installations/cache Chromium/FFmpeg/npm, **un seul rerun des jobs échoués**.
- Pour les autres échecs, si le jeton utilisateur GitHub autorisé `COPILOT_DISPATCH_TOKEN` ou `GH_AW_AGENT_TOKEN` existe : commenter `@copilot` sur **la PR existante**, maximum **une fois par SHA et deux fois par PR** ; le correctif reste soumis à la CI et aux règles de fusion. Si ce jeton manque, l'agent ne peut être lancé automatiquement ; le workflow signale la limite sans faux succès.
- Un run peut relancer au maximum **deux** chantiers, aucune revue automatique Copilot, aucune création d'une seconde issue ou PR, aucun appel OpenAI applicatif.

## Livraison de production

Une CI verte n'est pas un certificat de conformité. Les workflows de fusion existants sont limités aux modifications techniques de faible risque et déclenchent la CI `main` sur le SHA de fusion. Le Workers Build Cloudflare est distinct et ses **preuves de publication en production** doivent être confirmées sur le SHA et l'URL effectivement exposée. Ce harness de récupération ne déploie **jamais** lui-même pour éviter un contournement de ces portes ou un déploiement en doublon.

**Restent fermés :** CGV, société, médiateur, facturation/Stripe Live, changements de permissions/Auth/RLS, migrations, activation IA payante et publication d'applications stores. Un script automatique ne peut pas inventer les documents ou autorisations externes ; aucun test local ne les débloque. Ne pas supprimer ces garde-fous pour obtenir un faux full-auto.

Réutiliser `docs/work-registry.json`, `REPRISE.md` et les issues existantes pour la traçabilité. Tout déblocage de production doit se faire sans contourner les protections GitHub et avec vérification de déploiement réelle.

## Contrôle automatique de livraison technique

Le workflow `mentioncheck-production-release-evidence.yml` vérifie en lecture seule, sur le **SHA exact** de `main`, la CI avec ses deux jobs réussis, le check `Workers Builds: mentioncheck` réussi et le chargement HTTPS des pages publiques `/` et `/login`. Il s'exécute après CI `main` (ou au planning), sans ouvrir Stripe, envoyer de données, appeler l'IA, déployer, modifier Cloudflare ni déclencher des paiements. Le CI/build succès ne prouve pas l'identité SHA du Worker actif : **l'attestation exacte de déploiement reste distincte** et nécessite les métadonnées de version Cloudflare ou une sonde SHA signée. En cas d'échec, le job échoue fermé ; pas d'auto-rollback aveugle sur la production.

**Réveil immédiat supplémentaire** : une CI verte de `main` (push ou workflow_dispatch) déclenche aussi l'inventaire des PR agents bloquées, sans attendre le cron. Maximum deux récupérations par run et aucune réouverture d'une CI réelle déjà KO autrement que par les règles de retry/agent ci-dessus.

**Contrôle anti-fausse-preuve Cloudflare :** les checks `Workers Builds: mentioncheck` qui correspondent à des URLs `/production/previews/<branche>/builds/...` sont rejetés, même s'ils sont attachés par GitHub au même SHA que `main`. Seul le check de **production du Worker `mentioncheck`** dont l'URL contient exactement `/workers/services/view/mentioncheck/production/builds/` (compte Cloudflare attendu, HTTPS) est admissible. Un build de `mentioncheck-media-retention` n'est jamais compté pour `mentioncheck`.
