# MentionCheck — état réel de l'automatisation (6 novembre 2026)

Le dépôt est `totorina47501-wq/Project3`, sur `main`. Ce document ne constitue pas une preuve de déploiement.

## Vérifications distantes

- Dispatch Copilot validé : [run #42221900584](https://github.com/totorina47501-wq/Project3/actions/runs/42221900584) (3e tentative réussie avec le secret utilisateur), issue #54 affectée et PR #65 créée.
- PR #65 (tests hors ligne et rapport d'audit) fusionnée au commit `5a25fae`; la clôture de #54 a automatiquement réveillé le dispatcher [run #42231044634](https://github.com/totorina47501-wq/Project3/actions/runs/42231044634).
- Issue #55 affectée à Copilot, PR #67 ouverte, [CI de la branche](https://github.com/totorina47501-wq/Project3/actions/runs/42231105790) réussie.
- CI Copilot de la PR #34 initialement `action_required` sur [run #42056126056](https://github.com/totorina47501-wq/Project3/actions/runs/42056126056). Un commit de revalidation sans changement de comportement (`e9629b1`) a lancé une nouvelle CI [run #42231739396](https://github.com/totorina47501-wq/Project3/actions/runs/42231739396) sans approbation humaine préalable ; vérifier sa conclusion sur le SHA exact avant toute fusion.
- La tentative de récupération via [run #42231378892](https://github.com/totorina47501-wq/Project3/actions/runs/42231378892), `POST /actions/runs/{id}/approve`, a renvoyé HTTP 403. Ce point d'API est documenté pour les PR issues de forks, et ne constitue pas une solution fiable pour les exécutions anciennes bloquées de Copilot. Le workflow inefficace et son test sont supprimés pour éviter une fausse impression de succès.
- Les tests de PR sont désormais limités à `GITHUB_TOKEN` avec `contents: read`. Les autres secrets ne sont pas transmis à la CI.

## Couverture et limites

Le dispatcher planifié fonctionne toutes les demi-heures **à titre de demande de planning**, GitHub pouvant décaler les runs. La limite est de deux issues Copilot affectées simultanément ; un candidat attend si deux PR/issus restent actives.

La fusion automatique existante s'applique seulement au sous-ensemble sûr de documentation et tests prévu par `.github/workflows/mentioncheck-agent-automerge.yml` et au chemin documentaire opt-in de `.github/workflows/factory-safe-automerge.yml`. Une CI verte ou un job d'automerge `success` ne suffit pas à prouver une fusion. Les changements source, auth, sécurité, billing et les workflows ne sont pas fusionnés sans contrôle des protections GitHub.

Le statut `Workers Builds: mentioncheck` s'est avéré en échec sur plusieurs PR et doit être distingué des deux jobs GitHub CI. Aucun contrôle Cloudflare n'a été désactivé par ce correctif.

Si de nouvelles PR Copilot restent à `action_required`, vérifier l'option administrateur **Settings → Copilot → Cloud agent → Require approval for workflow runs**. Il n'existe pas ici d'autorisation pour modifier ce réglage par le connecteur GitHub. Avant tout assouplissement, vérifier les permissions des workflows et l'accès aux secrets.

## Critères pour annoncer « full auto »

1. Exécution de CI sur chaque nouvelle PR Copilot, sur le SHA courant.
2. Affectation puis reprise du dispatch après fermeture ou fusion, sans duplications.
3. Fusion des PR admissibles confirmée dans GitHub avec SHA exact et protections respectées.
4. Aucun autre garde bloquant sans stratégie autorisée et testée, notamment les échecs externes Cloudflare.
5. Production verte sur le SHA effectivement déployé et possibilité de rollback.

Ne pas confondre automatisation des tâches, fusion sur main et déploiement en production.

## Reprise des fusions sûres

Le workflow existant d'auto-merge conserve ses gardes `workflow_run` et gagne une récupération planifiée à :10/:40 sur `main`, sans checkout de PR. Celle-ci ne fusionne qu'une PR Copilot documentaire/de tests par passage, si l'agent a terminé, que la CI exacte SHA est verte (deux jobs obligatoires) et si GitHub autorise effectivement la fusion. Une CI peut se terminer avant l'agent : cela ne doit plus immobiliser les PR autorisées. Aucun code applicatif, workflow, dépendance ou script n'est fusionné automatiquement. La réussite réelle d'un run planifié et d'une fusion reste à constater avant de déclarer cette partie validée.
