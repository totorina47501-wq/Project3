# MentionCheck — Dispatch Codex séparé (10 novembre 2026)

## Extension de capacité — 10 novembre 2026

- Objectif utilisateur : ajouter **deux places Codex** au plafond initial d'une mission, soit **trois missions simultanément occupées au maximum** dans le dispatcher MentionCheck.
- Le dispatcher vérifie les issues et PR Codex ouvertes. Une PR de clôture explicitement liée à une issue Codex déjà assignée occupe **une seule place**, pas deux. Les PR Codex orphelines/non fusionnées continuent de réserver une place pour éviter les développements en doublon.
- Un passage peut remplir plusieurs places disponibles ; contrôle de l'affectation après chaque mutation GitHub et sérialisation du workflow conservés. Les missions doivent porter **uniquement** `agent:codex`, sans `agent:approved` ; rien n'est promu automatiquement.
- La valeur `MAX_ACTIVE=3` est une limite **locale au workflow**, pas une garantie de trois sessions Codex proposées par GitHub/ChatGPT ; l'utilisation peut consommer des crédits Codex. Des issues approuvées distinctes et des sessions réelles restent nécessaires pour remplir les places.
- La protection `release:evidence-required` et les contrôles de revue, sécurité, Stripe Live, OpenAI API et données de production ne sont pas modifiés.

## Portée

- Workflow : `.github/workflows/mentioncheck-codex-dispatch.yml` ; calendrier `:05` et `:35` (best effort GitHub Actions), et réveil immédiat sur une issue **ouverte** ou **étiquetée**, ou sur la clôture d'une issue/PR. Ces événements ne contournent pas le plafond de trois missions Codex occupées simultanément.
- La file Copilot existante reste sur `:00` et `:30`. Son dispatcher ignore désormais toute issue portant `agent:codex` ou déjà assignée à Codex.
- Les issues destinées à Codex portent **uniquement** le label `agent:codex` ; ne pas ajouter `agent:approved` réservé à la file Copilot.
- Jusqu'à trois missions Codex actives : le workflow refuse de dépasser le plafond, compte les PR ouvertes non déjà liées à une issue attribuée et vérifie chaque nouvelle affectation.
- Aucune action de déploiement, paiement, purge ou auto-merge n'est ajoutée. Les corrections sensibles restent hors fusion automatique.

## Vérification sur le backlog actuel

- Historique du 6 novembre : l'issue #16 était attribuée à Codex et la PR #79 ouverte. Depuis le 10 novembre, #16 est suivie par Copilot dans la PR #123, et la PR Codex #94 demeure en brouillon tant qu'elle n'est pas explicitement résolue. Vérifier l'état actuel avant de créer des missions distinctes.
- Les issues #59–#63 sont réservées à Copilot et restent inchangées.
- L'exécution manuelle en `workflow_dispatch` démarre par défaut en `dry_run=true`.

## Prérequis d'authentification

- Le workflow lit `CODEX_DISPATCH_TOKEN`, ou à défaut le secret existant `COPILOT_DISPATCH_TOKEN` / `GH_AW_AGENT_TOKEN`. Jamais de jeton dans le dépôt.
- La documentation GitHub couvre explicitement l'affectation de Copilot via API. **L'équivalence pour le partenaire Codex n'est pas attestée**. Un test réel de l'issue #86 a démontré que REST ne conservait pas l'assignee Codex. Une mutation GraphQL `addAssigneesToAssignable` est désormais tentée avec l'identité Bot confirmée par la PR #79, et l'affectation est revérifiée. Le lancement de session n'est pas garanti par cette seule étape.
- Même si GitHub conserve l'assignee Codex, cela ne prouve pas encore la création d'une session ou PR. Ne pas déclarer Full Auto avant un test réel concluant.

## Recette de certification

1. Attester la CI sur le SHA exact de la PR ajoutant ce workflow.
2. Après fusion sur `main`, vérifier en `dry_run=true` le nombre de places réellement occupées, y compris la PR #94 si elle est encore ouverte.
3. Préparer uniquement des issues de travail réellement nécessaires, avec fichiers distincts des missions Copilot, étiquetées `agent:codex` sans `agent:approved`. Lancer le workflow `dry_run=false` ou attendre le réveil GitHub.
4. Confirmer l'assignee Codex **et** une nouvelle session/PR Codex. Si l'API GitHub refuse l'agent partenaire, ne pas contourner ou réassigner à Copilot.

Références : `REPRISE.md`, `docs/work-registry.json`, `docs/49-agent-dispatch-automerge-audit.md`.
