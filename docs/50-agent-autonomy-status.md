# MentionCheck — état réel de l'automatisation (6 novembre 2026)

Le dépôt est `totorina47501-wq/Project3`, sur `main`. Ce document ne constitue pas une preuve de déploiement.

## Augmentation de capacité du dispatcher — proposition du 10 novembre 2026

- Plafond du **dispatcher MentionCheck** porté de **2 à 4 issues Copilot affectées simultanément** via `MAX_ACTIVE` ; cette limite est propre à notre workflow, pas une preuve d'autorisation de quatre sessions cloud par l'abonnement GitHub.
- Un déclenchement peut maintenant remplir **toutes les places libres** dans la même exécution au lieu d'affecter une seule issue. Le verrou GitHub `concurrency` continue de sérialiser les dispatchs et chaque attribution est revérifiée auprès de GitHub avant de compter la place.
- **Aucune issue n'est inventée ni approuvée automatiquement** : le dispatcher exige toujours `agent:approved`, écarte les issues Codex et les issues déjà couvertes par une PR, refuse les secrets manquants et conserve le mode `dry_run` par défaut pour `workflow_dispatch`.
- L'ouverture de nouvelles missions peut utiliser des requêtes premium et des minutes GitHub Actions. La disponibilité réelle, les quotas GitHub et la preuve d'un cycle à plus de deux agents simultanés restent à vérifier après intégration sur `main`.
- Les changements Auth/RLS/SQL/release, Stripe et OAuth restent soumis aux revues et protections existantes. Aucun auto-merge sensible, paiement ou appel IA fournisseur n'est autorisé par ce réglage.

## Vérifications distantes

- Dispatch Copilot validé : [run #42221900584](https://github.com/totorina47501-wq/Project3/actions/runs/42221900584) (3e tentative réussie avec le secret utilisateur), issue #54 affectée et PR #65 créée.
- PR #65 (tests hors ligne et rapport d'audit) fusionnée au commit `5a25fae`; la clôture de #54 a automatiquement réveillé le dispatcher [run #42231044634](https://github.com/totorina47501-wq/Project3/actions/runs/42231044634).
- Issue #55 affectée à Copilot, PR #67 ouverte, [CI de la branche](https://github.com/totorina47501-wq/Project3/actions/runs/42231105790) réussie.
- CI Copilot de la PR #34 initialement `action_required` sur [run #42056126056](https://github.com/totorina47501-wq/Project3/actions/runs/42056126056). Un commit de revalidation sans changement de comportement (`e9629b1`) a lancé une nouvelle CI [run #42231739396](https://github.com/totorina47501-wq/Project3/actions/runs/42231739396) sans approbation humaine préalable ; vérifier sa conclusion sur le SHA exact avant toute fusion.
- La tentative de récupération via [run #42231378892](https://github.com/totorina47501-wq/Project3/actions/runs/42231378892), `POST /actions/runs/{id}/approve`, a renvoyé HTTP 403. Ce point d'API est documenté pour les PR issues de forks, et ne constitue pas une solution fiable pour les exécutions anciennes bloquées de Copilot. Le workflow inefficace et son test sont supprimés pour éviter une fausse impression de succès.
- Les tests de PR sont désormais limités à `GITHUB_TOKEN` avec `contents: read`. Les autres secrets ne sont pas transmis à la CI.

## Couverture et limites

Le dispatcher planifié fonctionne toutes les demi-heures **à titre de demande de planning**, GitHub pouvant décaler les runs. Historiquement le plafond était de deux issues Copilot affectées simultanément ; la proposition du 10 novembre porte ce plafond à quatre une fois fusionnée sur `main`. Les candidats attendent lorsqu'aucune place libre n'est disponible.

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
