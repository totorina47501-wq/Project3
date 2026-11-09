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

## Suite — reprise des tests du runner média (6 novembre 2026)

La PR Copilot #69 (`Fixes #56`) modifie uniquement `docs/35-local-media-pipeline.md` et le test hors ligne `workers/media-jobs/tests/sql-pipeline.test.mjs`. Le moteur de fusion sûreté autorisait déjà `tests/` mais refusait ce répertoire de tests du runner, ce qui laissait le slot Copilot occupé malgré la CI réussie.

Le même moteur conserve toutes ses vérifications (auteur et branche Copilot, même dépôt, SHA de PR exact, CI `quality` et runner réussis, session cloud Copilot terminée, fichiers limités, aucune suppression/renommage) et autorise en plus **uniquement** les fichiers `workers/media-jobs/tests/*.test.mjs` ; aucun code du runner, SQL de production, workflow ou script hors répertoire de tests n'est autorisé par cette extension. La récupération planifiée utilise strictement la même nouvelle règle. Une validation distante doit confirmer ensuite l'intégration de la PR #69 et la libération automatique de l'issue #56 ; un job terminé `success` sans fusion ne suffit pas.

## Récupération événementielle (6 novembre 2026)

Les déclenchements `schedule` GitHub ne sont pas une horloge garantie et n'avaient pas produit de run de récupération observable au moment de cet audit (les dispatchers, eux, avaient déjà tourné). Pour éviter de bloquer les PR brouillon Copilot terminées lorsque la minuterie tarde, le job `recovery` s'exécute également après **CI MentionCheck réussie**, sur `pull_request` ou `push`. Il dépend du job `merge` du même workflow, avec une condition `always()` et refuse de s'exécuter si le job précédent a échoué : aucune double fusion concurrente dans le même run.

La tâche de récupération ne checkout aucune PR, n'exécute aucun code tiers et garde **toutes** les conditions originales : auteur Copilot, branche `copilot/*` locale, fichiers et chemins sûrs, SHA exact, deux jobs CI réussis, cloud agent terminé, protections GitHub appliquées. Les documents sensibles, dont `docs/04-mia-archives.md`, restent exclus. Une fusion positive par `github-actions[bot]` et la clôture subséquente de l'issue doivent être prouvées par l'API avant de déclarer la chaîne autonome. Les créneaux `:10/:40` restent un secours.

## Continuation après fusion par `GITHUB_TOKEN` (6 novembre 2026)

Les PR Copilot #72 (Mia RAG) et #69 (pipeline média) ont été fusionnées automatiquement le 6 novembre 2026 par `github-actions[bot]` sur `main`. Leurs issues #58 et #56 sont toutefois restées ouvertes et aucun nouveau run `push` de `MentionCheck CI` ni `pull_request: closed` du dispatcher n'a démarré suite à ces fusions. C'est un comportement documenté de GitHub : les événements ordinaires produits par `GITHUB_TOKEN` ne déclenchent pas d'autres workflows ; `workflow_dispatch` et `repository_dispatch` sont les exceptions autorisées ([documentation GitHub](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)).

Pour lever ce blocage sans nouveau secret, sans PAT privilégié de fusion et sans service externe :

1. Après une fusion *effectivement réussie* par les jobs de confiance `merge` ou `recovery`, ceux-ci déclenchent `MentionCheck CI` via son entrée `workflow_dispatch` sur `main`. Le workflow CI exécute les mêmes jobs `quality` et `Image du runner média (sans fournisseur)` qu'un `push` normal. Aucune tâche n'est marquée verte par simple extrapolation de la PR.
2. Le workflow de fusion accepte aussi l'événement de fin d'une CI `workflow_dispatch` réussie. Il vérifie le **SHA exact de `main`** avant d'envoyer un `workflow_dispatch` réel (option `dry_run: false`) à `mentioncheck-agent-dispatch.yml` si aucune autre PR sûre n'est à fusionner.
3. Le dispatcher déjà en place ferme seulement les issues associées à une PR Copilot réellement fusionnée dans ce dépôt avec référence de clôture explicite. Il recalcule la capacité, refuse toute affectation au-delà de deux missions et délègue l'affectation avec le secret utilisateur `COPILOT_DISPATCH_TOKEN` existant.

Les exécutions déclenchées via ce mécanisme doivent être vérifiées réellement après intégration : CI sur `main` final, clôture #56/#58 et affectation #59 ou suivante. Le cron GitHub reste un filet de sécurité. Le workflow de confiance ne checkout aucun code de PR avec des droits d'écriture.

## Addendum — cycle Codex #86 → #89 (7 novembre 2026)

Cet addendum complète l'audit avec un **deuxième cycle observé** centré sur l'issue #86 et la PR #89. Les constats ci-dessous restent datés et bornés aux preuves listées.

| Preuve distante | Résultat observé | Limite explicite |
|---|---|---|
| [MentionCheck Codex dispatch #42359521650](https://github.com/totorina47501-wq/Project3/actions/runs/42359521650) (issue [#86](https://github.com/totorina47501-wq/Project3/issues/86)) | Run terminé `success` ; l'affectation GraphQL de Codex est attestée dans le cycle de certification de l'issue #86. | Ce run seul ne prouve ni la création d'une PR ni une fusion ultérieure. |
| [Running OpenAI Codex #42359542125](https://github.com/totorina47501-wq/Project3/actions/runs/42359542125) et [PR #89](https://github.com/totorina47501-wq/Project3/pull/89) | Session Codex terminée `success` ; PR #89 créée automatiquement. | La création de PR ne vaut pas validation CI ni fusion automatique. |
| [MentionCheck CI #42367668844](https://github.com/totorina47501-wq/Project3/actions/runs/42367668844), SHA PR `01e8692957a3d97d4ffea82fdb45decb6e91ece5` | CI `pull_request` verte sur le SHA final de #89 après blocage initial `action_required`. | La relance a nécessité un rafraîchissement manuel unique du SHA de la branche PR après changement de politique d'approbation ; ce n'est pas une preuve de reprise 100% événementielle sans intervention. |
| [Codex safe-code auto-merge #42367989619](https://github.com/totorina47501-wq/Project3/actions/runs/42367989619), [PR #89](https://github.com/totorina47501-wq/Project3/pull/89), issue [#86](https://github.com/totorina47501-wq/Project3/issues/86) | Run `success` ; PR #89 fusionnée par `github-actions[bot]` ; issue #86 clôturée automatiquement. | La preuve porte sur cette PR admissible ; elle ne généralise pas à toutes les futures PR. |
| [MentionCheck CI main #42368002073](https://github.com/totorina47501-wq/Project3/actions/runs/42368002073), SHA `851df9b80f225fb016c9c0a22fa5b9f4dc039fe3` | CI post-fusion sur `main` terminée `success` sur le SHA fusionné. | Le vert CI `main` n'implique pas que tous les workflows `workflow_run` du même SHA se déclenchent sans approbation supplémentaire. |
| Commentaire de certification propriétaire sur [issue #86](https://github.com/totorina47501-wq/Project3/issues/86#issuecomment-6706267736) (Cloudflare mentioncheck + media-retention verts sur le SHA `851df9b...`) | Confirmation complémentaire d'un statut vert côté Cloudflare sur le même SHA. | Source déclarative d'audit (commentaire d'issue), distincte d'un run GitHub Actions natif. |
| [Codex safe-code auto-merge #42368001911](https://github.com/totorina47501-wq/Project3/actions/runs/42368001911) (et autres `workflow_run` acteur Codex) | `conclusion: action_required` persistant sur certains déclenchements `workflow_run` post-fusion. | La reprise immédiate de **tous** les workflows n'est pas certifiée ; le cron reste best effort et non ponctuel. |

### Distinction de portée (ne pas extrapoler)

- **Démontré sur ce cycle** : dispatch Codex réel, exécution agent, PR créée, CI verte sur SHA de PR après intervention de politique + rafraîchissement manuel unique, fusion automatique sûre, clôture d'issue et CI `main` verte sur SHA fusionné.
- **Non démontré à ce stade** : cycle « zéro intervention humaine » garanti pour toutes les PR futures, ni reprise événementielle immédiate universelle de tous les `workflow_run` déclenchés par l'identité Codex.


## Réveil événementiel des missions Copilot — 9 novembre 2026

- À 12h48 (Europe/Paris), aucun run GitHub `schedule` à 12h30 n'était observable, alors que l'issue [#105](https://github.com/totorina47501-wq/Project3/issues/105) était `agent:approved` et sans affectation. Le run précédent `workflow_dispatch` était antérieur à la création de l'issue. Cause externe exacte du saut de planification non prouvée : un cron GitHub Actions est best-effort.
- Relance du **job existant** [#42606576564, tentative 2](https://github.com/totorina47501-wq/Project3/actions/runs/42606576564), `DRY_RUN=false`, statut `success` : affectation `Copilot` effectivement persistée sur #105 et ouverture de la [PR Copilot #106](https://github.com/totorina47501-wq/Project3/pull/106). Le code de l'application n'a pas été touché.
- Le dispatcher écoute désormais aussi les événements `issues.opened` et `issues.labeled`, en plus de `closed`, pour démarrer sur la création/validation sans attendre `:00` ou `:30`. Les garde-fous de la file (`agent:approved`, exclusion Codex, plafond de 2, anti-doublon et vérification post-affectation) restent inchangés. Le cron demeure un filet de sécurité, non une garantie de ponctualité.
- Preuve à contrôler sur la prochaine **nouvelle** issue approuvée : run d'événement `issues` sur `main`, affectation persistée, puis PR agent. Cette modification ne prouve pas à elle seule ce scénario.



## Auto-intégration des PR Copilot à faible risque — 9 novembre 2026

- **Motif** : les PR #106 et #109 ont nécessité un passage manuel de brouillon à prêt/fusion malgré Copilot terminé et CI verte. Le workflow existant limitait volontairement l'auto-merge aux seuls tests/docs ; son réveil dépendait surtout de la CI, alors que le run cloud agent peut finir *après* elle.
- **Correctif proposé** : le workflow de récupération sur la branche fiable `main` écoute aussi la fin de la session Copilot et les événements de PR `ready_for_review`, `edited`, `synchronize`. Aucun checkout du code de PR avec un token d'écriture. Rattrapage planifié conservé comme secours GitHub best-effort.
- **Conditions cumulatives** : PR de l'acteur `Copilot` sur branche `copilot/` du même dépôt vers `main`; une seule issue ouverte explicitement `agent:approved`, réellement affectée à Copilot ; aucune étiquette sensible ; fichiers uniquement tests, docs autorisés, ou petites surfaces UI explicitement listées ; aucune suppression/renommage, limites de lignes, patch UI disponible et absence de nouveaux appels réseau/accès données/données sensibles dans les lignes ajoutées ; dernière CI au SHA exact `quality` + runner média SUCCESS ; dernière session agent terminée SUCCESS après le commit ; relecture de l'état et merge SHA verrouillé.
- **Hors auto-merge** : API, Auth, RLS/SQL, billing, RGPD, sécurité, scripts et workflows, configuration, dépôts externes, déploiement, fichiers volumineux ou diff indécidable, PR Codex #94 / issue #16. Un avertissement GitHub est émis ; ne jamais contourner une protection GitHub.
- **Post-fusion** : CI de `main` explicitement déclenchée, puis dispatcher relancé après CI `main` verte. Ce mécanisme n'autorise **ni ouverture commerciale ni activation de prestataire payant**.
- **Portée de la preuve** : le test statique de la politique et la CI du workflow sur sa PR sont nécessaires. Le cycle complet pour une **nouvelle PR Copilot admissible** (fin agent → merge robot → CI `main` → clôture issue → prochain dispatch) reste à observer avant d'annoncer « full auto démontré ». Ne pas simuler une fusion ni consommer de crédits IA pour fabriquer une mission de test.


## Robustesse des références de PR Copilot (9 novembre 2026)

Copilot peut citer une issue approuvée dans la description de sa PR **et** recopier la même instruction `Fixes #N` depuis le texte initial de l'issue. Le garde-fou refuse toujours une PR sans référence ou citant plusieurs **numéros distincts**, mais accepte les doublons du **même numéro** (`new Set(closingRefs).size === 1`). Le contrôle d'état, label `agent:approved`, assignee, SHA CI, identité Copilot, paths autorisés et absence de collecte restent obligatoires. Correction ciblée pour éviter que le premier cycle autonome post-#110 se bloque sur un détail de format, sans modifier les conditions de sécurité ni autoriser le lancement commercial.
