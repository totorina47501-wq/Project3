# Mia — évaluation RAG hors ligne

Ce document rassemble la recette locale des tests de l'assistant Mia, **sans appel fournisseur**, sans réindexation du corpus et sans migration de données. La documentation juridique et les procédures d'approbation des sources restent dans [docs/04-mia-archives.md](04-mia-archives.md) et ne sont pas modifiées par cette PR.

## Couverture et limites

- `tests/unit/mia-assistant.test.ts` vérifie que seules les citations des sources effectivement récupérées sont conservées, et qu'une question hors corpus est refusée sans appel au modèle.
- `tests/unit/mia-vector-retrieval.test.ts` simule les erreurs d'embedding et de RPC, le repli lexical et la journalisation des coûts.
- `tests/unit/mia-cost-ledger.test.ts` vérifie les métriques, budgets, remboursement de quota et le rejet d'une conversation qui n'appartient pas au compte courant.
- `tests/unit/privacy-personal-data.test.ts` vérifie l'isolation de données entre comptes. La suite SQL `tests/sql/ai_usage_security.sql` complète les assertions locales sur la propriété des métriques.

## Commande reproductible

```sh
npx vitest run tests/unit/mia-assistant.test.ts tests/unit/mia-vector-retrieval.test.ts tests/unit/mia-cost-ledger.test.ts tests/unit/privacy-personal-data.test.ts
```

Ces tests utilisent des mocks locaux et ne prouvent ni la pertinence juridique des réponses, ni l'isolation sur une instance distante, ni la conformité de l'indexation en production. Ils ne déclenchent aucune transaction, opération destructive ni consommation OpenAI réelle.

La PR Copilot #72 met uniquement à jour des tests, le registre de travail et ce document technique. Les documents juridiques exclus de la liste blanche d'auto-merge restent inchangés.
