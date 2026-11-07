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
