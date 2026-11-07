# MentionCheck — fusion sûre des PR Codex (7 novembre 2026)

Cette voie complète le dispatcher Codex déjà déployé, sans modifier le moteur Copilot existant.

## Conditions obligatoires
- PR créée par le bot GitHub **Codex**, branche codex/ du même dépôt et ciblant main.
- Uniquement fichiers de tests et Markdown documentaire, jamais workflow, script, production, migration, dépendance, registre JSON, ni documents juridiques/sécurité sensibles. Aucun renommage/suppression.
- Maximum 20 fichiers et 300 lignes ajoutées/supprimées par fichier.
- Exécution **Running OpenAI Codex** achevée avec succès.
- GitHub Actions **MentionCheck CI** terminée avec succès sur le SHA exact de la PR, jobs quality et runner média réussis.
- Les protections de branche restent appliquées par GitHub ; refus de fusion = arrêt, pas de contournement.
- Une seule fusion par exécution, puis relance de la CI de main. Clôture uniquement d'une issue agent:codex explicitement référencée par la PR fusionnée.
- Reprise de la file Codex après une CI main verte et à jour.

## Blocage externe constaté
La PR #89 créée automatiquement par Codex sur #86 signale **action_required** avant les jobs CI : ce n'est pas un échec de tests. Le run ne peut pas être considéré comme vert et le workflow **ne fusionnera pas cette PR** tant que la politique GitHub d'approbation des runs Codex n'est pas corrigée.

En tant qu'administrateur du dépôt, vérifier **Settings → Copilot → Cloud agent → Policies → Require approval for workflow runs**. Modifier ce garde-fou est une décision de sécurité : ne pas le désactiver si des workflows exposent des secrets ou des accès en écriture à du code non revu. Vérifier également les paramètres **Settings → Actions → General → Approval for running fork pull request workflows** et les éventuelles règles d'organisation.

Ce lot ne modifie pas ces paramètres GitHub et ne crée aucun secret, service externe payant ou contournement d'approbation. Il prépare uniquement la voie sûre après autorisation GitHub.

## Validation
- CI sur le SHA exact du workflow Codex safe auto-merge.
- PR Codex #89 : attendre un vrai run CI complet vert sur son SHA, puis un run Agent safe-code auto-merge Codex qui confirme la fusion.
- Contrôler la CI main et la clôture de #86 ; vérifier qu'une autre issue agent:codex peut ensuite être dispatchée seule, sans duplications Copilot.

## Reprise CI à autorisations minimales (7 novembre 2026)

Après le cycle #86→#89, un **deuxième** lancement Codex sur l'issue #91 a créé la PR #92. Les runs CI déclenchés directement par le bot Codex sont encore marqués `action_required` (notamment #42372955787) avant tout job, malgré les options de l'interface. Cette protection ne doit pas être contournée via un workflow `pull_request_target` exécutant du code non revu avec des droits d'écriture.

Le workflow de confiance déjà exécuté sur `main` ajoute une récupération ciblée : pour une PR de **Codex** appartenant au même dépôt, branche `codex/*`, ne modifiant que tests ou Markdown non sensibles, et dont la session agent est **terminée avec succès**, un run planifié peut déclencher **une seule fois par SHA** le workflow `ci.yml` en mode `workflow_dispatch` sur la branche de cette PR. `ci.yml` utilise uniquement `contents: read`, désactive OpenAI/paiement/rétention et n'expose aucun secret GitHub. Le filtre de fichiers empêche toute modification du workflow CI lui-même. Une vraie CI `pull_request` en échec bloque la récupération ; seuls des runs `action_required` sans job autorisent cette voie. Les CI en cours et les relances déjà tentées sont dédupliquées.

La fusion exige **toujours** : un SHA PR exact, des jobs `quality` et runner média verts, une session agent réussie, un auteur Codex vérifié, les fichiers autorisés et les protections de branche GitHub. La CI de remplacement n'est éligible que si elle porte le même SHA, la même branche, et l'acteur `github-actions[bot]`. La réussite du workflow de reprise ne suffit pas en soi à certifier une nouvelle fusion ; vérifier une PR réelle et sa CI de `main`.

## Blocage explicite des recettes de production (7 novembre 2026)

Les PR de sécurité qui exigent une preuve distante portent le label `release:evidence-required`. Le workflow Codex de fusion sûre les ignore **avant toute récupération de CI et immédiatement avant la demande de fusion**. Les tests unitaires vérifient ces deux gardes. Cette exclusion évite qu'une PR de tests ou de documentation ferme prématurément l'issue de recette. Le label est posé sur la PR #94 liée à l'issue #16 ; la CI verte locale ne prouve ni staging, ni restauration, ni RLS A/B sur le cloud. Seule une revue des preuves réelles peut lever ce label.
