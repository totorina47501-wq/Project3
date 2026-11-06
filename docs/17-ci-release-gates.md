# Portes de livraison MentionCheck (sans services payants)

## Vérifications obligatoires par PR
- `node scripts/work-inventory.mjs check` : détecter les doublons de lots.
- `bun install --frozen-lockfile` : installation reproductible (à valider contre le lockfile présent).
- `bun run typecheck`, `bun run lint`, `bun run test`, `bun run build`.
- `bun run test:video:offline` et `bun run test:carousel:offline`.
- Aucun appel à OpenAI, Stripe ou Resend dans la CI.
- Vérifier les statuts GitHub Actions sur le SHA exact, pas uniquement sur le nom de branche.

## Portes avant fusion
1. Diff ciblé ; aucune modification des branches des autres lots.
2. CI verte sur le dernier SHA et revue des migrations SQL/RLS si concernées.
3. Vérification des secrets absents du diff et de la sortie des tests.
4. Comparaison avec la branche Codex pour éviter les duplications.
5. Fusion manuelle seulement après validation explicite.

## Portes avant production
- Variables de production et domaine vérifiés, sans secrets dans le dépôt.
- Tests authentifiés et isolation staging/production.
- Backup PostgreSQL et exercice de restauration sur base isolée.
- Plan de rollback de l'image et des migrations ; journal des SHA.
- Vérification mobile, accessibilité clavier et parcours RGPD.
- Prestataires payants désactivés jusqu'à autorisation et test de bout en bout.

**Statut :** checklist opérationnelle, pas une preuve de réalisation.

## Vérification statique des liens Markdown internes

Hors réseau, sans dépendance : `npm run docs:links` (bloquant, code 1 si anomalie), `npm run docs:links:report` (inventaire non bloquant), `npm run docs:links:test` (tests unitaires).

Portée : `*.md` à la racine et `docs/**/*.md` (hors `docs/receipts`, généré). Ignorés : HTTPS/autres schémas, `mailto:`, `//`, fragments seuls, code inline et blocs de code.

Limitations : les ancres `#...` et les paramètres `?...` sont retirés sans vérification ; seuls les liens inline et les définitions de référence sont analysés (pas le HTML brut).
