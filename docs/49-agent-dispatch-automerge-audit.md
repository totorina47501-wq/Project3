# Audit des preuves de dispatch et d’auto-merge

État vérifié le 6 novembre 2026 à 13:20 UTC. Cet audit est une lecture des workflows, des PR et des runs GitHub disponibles ; il ne modifie aucun workflow, permission ou paramètre de protection et ne déclenche aucun dispatch ni aucune fusion.

## Workflows comparés

| Workflow | Déclenchement et sélection | Garde-fous et portée |
|---|---|---|
| `mentioncheck-agent-dispatch.yml` | Schedule à `:00` et `:30`, clôture d’issue/PR et `workflow_dispatch` (dry-run activé par défaut). Sélectionne les issues ouvertes `agent:approved`, non déjà affectées à Copilot, par numéro croissant ; plafond de deux affectations actives ; ignore une issue référencée par une PR ouverte. | Affectation vérifiée après l’appel ; blocage explicite si le jeton ou l’affectation échoue. Le lancement effectif dépend de la présence du secret GitHub et de l’accès Copilot. |
| `mentioncheck-agent-automerge.yml` | `workflow_run` de `MentionCheck CI`, terminé avec succès pour un événement PR. | Dépôt, auteur Copilot, branche `main`, SHA inchangé et absence du label réservé au workflow documentaire ; 1 à 30 fichiers non supprimés/renommés sous `tests/` ou `docs/`, limites de taille ; jobs `quality` et runner média réussis. Une PR brouillon n’est rendue prête qu’après succès du run de l’agent. |
| `factory-safe-automerge.yml` | Même événement CI terminé avec succès pour une PR. | PR ouverte non brouillon, même dépôt, base `main`, SHA inchangé et opt-in `factory:auto-merge-safe` ; Markdown `docs/` seulement, avec documents sensibles explicitement exclus ; mêmes deux jobs CI requis. |
| `copilot-docs-trusted-validation.yml` | `pull_request_target` pour PR Copilot sur `main` portant le label documentaire. | Validation en lecture seule des métadonnées/SHA et des seuls chemins `docs/factory/*.md` ; ne fusionne pas. |
| `ci.yml` | `pull_request` et `push` sur les branches déclarées. | Jobs `quality` et `Image du runner média (sans fournisseur)` ; c’est la source des résultats utilisés par les workflows `workflow_run`. |

Les deux workflows de fusion vérifient le SHA du run contre le `head.sha` courant avant de poursuivre, puis le revérifient immédiatement avant la requête de fusion en transmettant aussi ce SHA. L’API GitHub reste l’autorité pour appliquer les protections du dépôt. Un succès du job shell ou une CI verte ne démontre ni que la fusion a été demandée, ni qu’elle a été autorisée, ni que la PR a été fusionnée.

## Runs observés et portée de la preuve

| Preuve distante | Résultat observé | Ce qu’elle établit — et ce qu’elle n’établit pas |
|---|---|---|
| [Dispatch schedule #4](https://github.com/totorina47501-wq/Project3/actions/runs/42186135078), SHA `12b6723a18f326c605df4fcaf7398acf68f76a27`, 6 nov. 08:13 UTC | Run `schedule` et job `dispatch` réussis ; sortie indique 1 issue Copilot active sur 2. | Le contrôle de capacité s’est exécuté sur ce SHA. Ce run précède la correction d’affectation de la PR #64 ; son succès ne prouve donc pas le comportement de la version actuelle ni qu’une issue a été affectée. |
| [Dispatch schedule #3](https://github.com/totorina47501-wq/Project3/actions/runs/42141048170), SHA `abcdb79fbfd27c62256a1bb977b6f0a4e81e9415`, 6 nov. 01:02 UTC | Run `schedule` réussi. | Preuve historique d’un déclenchement planifié uniquement ; code antérieur. |
| [MentionCheck CI de la PR #64](https://github.com/totorina47501-wq/Project3/actions/runs/42221121115), SHA exact `9b5c540977fc31d38af43489602567e029b643d3`, 6 nov. 12:53 UTC | `quality` et `Image du runner média (sans fournisseur)` réussis. La PR #64 a ensuite été fusionnée par le propriétaire. | CI complète réussie sur le SHA de la PR ; la fusion observée de #64 n’est pas une preuve d’auto-merge (elle modifiait des workflows, hors liste blanche). |
| [Dispatch PR #64, tentative 3](https://github.com/totorina47501-wq/Project3/actions/runs/42221900584), SHA `9b5c540977fc31d38af43489602567e029b643d3` | Job `dispatch` réussi ; sortie indique 1 issue active sur 2. | Exécution du workflow PR avec le nouveau chemin d’affectation ; pas un run `schedule` et pas une preuve qu’un candidat a été affecté ou que le lancement cloud a abouti. |
| [Agent safe-code auto-merge #8](https://github.com/totorina47501-wq/Project3/actions/runs/42221827969) | Job `merge` terminé avec succès ; contexte de run lié à la CI de SHA `9b5c540977fc31d38af43489602567e029b643d3`. | « Success » n’atteste pas une fusion. La PR #64 modifiait `.github/workflows/ci.yml` et `mentioncheck-agent-dispatch.yml`, deux chemins interdits à ce workflow ; le propriétaire est indiqué comme auteur de la fusion de #64. |
| [Factory safe auto-merge #45](https://github.com/totorina47501-wq/Project3/actions/runs/42222547915) et [Agent safe-code auto-merge #9](https://github.com/totorina47501-wq/Project3/actions/runs/42222547955), SHA `fae8a497dacc81a26f0eeb3effc6f831912a2a9c` | Les jobs de fusion sont `skipped`. | Résultat attendu hors événement PR admissible ; ne démontre pas le chemin de fusion positif. |

## Lacunes et tests

- La recherche des tests et scripts (`tests/`, `scripts/`, et `.github/workflows/`) ne trouvait aucun test des contrats de sélection/auto-merge. Les suites offline de l’application ne couvraient pas ces filtres.
- Aucun run planifié réussi sur le SHA intégrant la correction #64 n’a été observé dans les runs consultés ; un run `pull_request` ne remplace pas cette preuve.
- Aucun exemple récent ne démontre un parcours de fusion auto admissible mené à terme. Les runs `skipped` ou le job de fusion `success` ne suffisent pas à établir l’autorisation effective.
- Les règles de protection de branche, les exigences de revue et le droit de contournement du jeton n’ont pas été vérifiés via l’API ; leur état reste à confirmer par un propriétaire. Ne pas contourner ces règles.
- Le test ajouté, `tests/unit/agent-workflow-contracts.test.ts`, vérifie hors réseau les déclencheurs, filtres d’issues, exclusions de chemins, labels, jobs requis et comparaisons SHA présentes dans les workflows. C’est une vérification statique des contrats : elle ne simule ni l’évaluation YAML par GitHub, ni les réponses API, ni les protections de dépôt.

Commande reproductible : `npm test -- tests/unit/agent-workflow-contracts.test.ts`.

## Périmètre et état

Aucun workflow, droit, secret, paramètre de protection, service externe, déploiement ou données distantes n’a été modifié. Aucune fusion n’a été déclenchée par cet audit. Les SHA et statuts cités ci-dessus sont des preuves de runs précis, pas une preuve de recette production ou de déploiement.

## Réconciliation automatique après fusion (6 novembre 2026)

Le run de dispatch [#42240642217](https://github.com/totorina47501-wq/Project3/actions/runs/42240642217) a affecté l'issue #58 après clôture de #57. L'issue #57 était restée ouverte malgré la fusion de la PR Copilot #70 par `github-actions[bot]`, ce qui saturait artificiellement le plafond de deux agents. La clôture de #57 a été effectuée par l'opérateur durant l'audit, puis le dispatch a confirmé la libération de capacité.

Le correctif proposé dans `mentioncheck-agent-dispatch.yml` réconcilie les issues ouvertes déjà affectées à Copilot avant le calcul de capacité : clôture uniquement si une PR effectivement fusionnée dans `main`, provenant du même dépôt et de Copilot, contient une référence explicite de fermeture de l'issue. Aucune fusion, suppression, déploiement ni modification des protections n'est ajoutée. La récupération et les deux tâches maximales restent inchangées.

Les tests statiques du contrat de réconciliation ne démontrent pas son exécution à distance. L'acceptation exige une CI verte sur le SHA exact, la fusion du correctif selon les contrôles normaux, puis un run de dispatch réussi et une preuve de clôture automatique lors d'une prochaine PR Copilot fusionnée. Le cron GitHub reste best effort : deux créneaux par heure ne garantissent pas une ponctualité stricte.
