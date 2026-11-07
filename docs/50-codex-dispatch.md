# MentionCheck — Dispatch Codex séparé (6 novembre 2026)

## Portée

- Workflow : `.github/workflows/mentioncheck-codex-dispatch.yml` ; calendrier `:05` et `:35` (best effort GitHub Actions), et réveil immédiat sur une issue **ouverte** ou **étiquetée**, ou sur la clôture d'une issue/PR. Ces événements ne contournent pas la limite d'une mission Codex simultanée.
- La file Copilot existante reste sur `:00` et `:30`. Son dispatcher ignore désormais toute issue portant `agent:codex` ou déjà assignée à Codex.
- Les issues destinées à Codex portent **uniquement** le label `agent:codex` ; ne pas ajouter `agent:approved` réservé à la file Copilot.
- Une seule mission Codex active : le workflow bloque toute nouvelle affectation s'il existe une issue déjà attribuée à Codex ou une PR Codex ouverte.
- Aucune action de déploiement, paiement, purge ou auto-merge n'est ajoutée. Les corrections sensibles restent hors fusion automatique.

## Vérification sur le backlog actuel

- Issue #16 déjà assignée à Codex ; PR #79 ouverte. Aucun nouveau dispatch automatique ne doit s'effectuer tant que ce travail est ouvert.
- Les issues #59–#63 sont réservées à Copilot et restent inchangées.
- L'exécution manuelle en `workflow_dispatch` démarre par défaut en `dry_run=true`.

## Prérequis d'authentification

- Le workflow lit `CODEX_DISPATCH_TOKEN`, ou à défaut le secret existant `COPILOT_DISPATCH_TOKEN` / `GH_AW_AGENT_TOKEN`. Jamais de jeton dans le dépôt.
- La documentation GitHub couvre explicitement l'affectation de Copilot via API. **L'équivalence pour le partenaire Codex n'est pas attestée**. Un test réel de l'issue #86 a démontré que REST ne conservait pas l'assignee Codex. Une mutation GraphQL `addAssigneesToAssignable` est désormais tentée avec l'identité Bot confirmée par la PR #79, et l'affectation est revérifiée. Le lancement de session n'est pas garanti par cette seule étape.
- Même si GitHub conserve l'assignee Codex, cela ne prouve pas encore la création d'une session ou PR. Ne pas déclarer Full Auto avant un test réel concluant.

## Recette de certification

1. Attester la CI sur le SHA exact de la PR ajoutant ce workflow.
2. Après fusion sur `main`, exécuter le workflow manuellement en mode `dry_run=true` et vérifier qu'il respecte la capacité occupée par #16/#79.
3. Une fois #16 et #79 clôturés, préparer une petite issue test `agent:codex`, sans `agent:approved`. Lancer le workflow `dry_run=false`.
4. Confirmer l'assignee Codex **et** une nouvelle session/PR Codex. Si l'API GitHub refuse l'agent partenaire, ne pas contourner ou réassigner à Copilot.

Références : `REPRISE.md`, `docs/work-registry.json`, `docs/49-agent-dispatch-automerge-audit.md`.
