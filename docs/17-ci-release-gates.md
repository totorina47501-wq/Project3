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

## Trace opérationnelle issue #16 (état documentaire)
- Fait en local/offline : recettes Playwright authentifiées sans fournisseur payant, refus 401/403, contrôles d'origine, isolation A/B SQL, upload média opt-in avec nettoyage ciblé.
- Non exécuté dans ce lot : validation staging vs production, vérification service_role distante, preuve RLS/RPC distante, exercice backup/restore et rollback sur environnement isolé.

## Addendum audit Supabase distant (lecture seule, 7 novembre 2026)

- Environnement inspecté : projet `zcztvberuihphqklhjsr` (ACTIVE_HEALTHY), PostgreSQL 17, région `eu-central-1`.
- Vérifié : 27 tables `public` avec RLS activée ; 22 avec politiques et 5 sans policy (`api_keys`, `law_documents`, `law_import_runs`, `stripe_webhook_events`, `workspace_invitations`) ; état intentionnel à confirmer côté accès métier serveur/privés.
- Vérifié : 18 migrations enregistrées à distance (présence), sans essai de restauration réelle.
- Vérifié : 5 RPC `SECURITY DEFINER` exposées à `authenticated` (`archive_brand_deal`, `delete_brand_deal_draft`, `remove_social_account`, `save_brand_deal`, `save_social_account`) avec garde-fous `search_path`, `auth.uid()` et absence d'`EXECUTE` pour `anon`; des tests d'autorisation E2E distants restent requis.
- Vérifié : `leaked password protection disabled` toujours présent dans Supabase Auth Advisor.
- Vérifié : aucune branche Supabase de staging et un seul projet relié ; ne pas simuler une séparation staging/prod inexistante.
- Toujours non exécuté : E2E distants authentifiés A/B, validation `service_role` hébergée, exercice backup/restore sur instance isolée et rollback applicatif/schéma.
- Règle de clôture : ne pas fermer l'issue #16 sur la seule base de preuves locales/documentaires ; une recette distante datée reste obligatoire.

**Statut :** checklist opérationnelle, pas une preuve de réalisation.

## Vérification statique des liens Markdown internes

Hors réseau, sans dépendance : `npm run docs:links` (bloquant, code 1 si anomalie), `npm run docs:links:report` (inventaire non bloquant), `npm run docs:links:test` (tests unitaires).

Portée : `*.md` à la racine et `docs/**/*.md` (hors `docs/receipts`, généré). Ignorés : HTTPS/autres schémas, `mailto:`, `//`, fragments seuls, code inline et blocs de code.

Limitations : les ancres `#...` et les paramètres `?...` sont retirés sans vérification ; seuls les liens inline et les définitions de référence sont analysés (pas le HTML brut).

## FFmpeg et FFprobe en CI (correctif 6 novembre 2026)

Le job `quality` sur `ubuntu-24.04` échouait avant les tests média, car l'installation APT de 87 dépendances (plus de 60 Mo) depuis les miroirs Azure dépassait les cinq minutes. Ce n'est pas un résultat négatif des tests applicatifs.

Le workflow `.github/workflows/ci.yml` télécharge désormais une archive Linux x64 FFmpeg **7.0.2** précompilée, contenant aussi FFprobe, depuis une [release GitHub immuable](https://github.com/publicala/ffmpeg-static/releases/tag/v7.0.2), miroir déclaré de la construction statique John Van Sickle. Le SHA-256 est **`abda8d77ce8309141f83ab8edf0596834087c52467f6badf376a6a2a4c87cf67`** ; l'archive est contrôlée avec `sha256sum --check` à chaque exécution, même après restauration du cache GitHub Actions. Les binaires sont également copiés dans `/usr/bin/ffmpeg` et `/usr/bin/ffprobe`, car les tests existants utilisent ces chemins absolus. Il n'y a aucune installation Ubuntu, aucun service payant, aucune nouvelle dépendance npm ni action tierce. Ce binaire GPL-3.0 reste limité à la CI, sans être distribué dans l'application. Le conteneur média conserve ses dépendances indépendantes et son job de validation.

**Recette exigée :** deux jobs `quality` et `Image du runner média (sans fournisseur)` réussis sur le SHA exact de la PR, puis réussite sur le SHA final de `main`. Si le téléchargement GitHub échoue, le job doit échouer explicitement, sans ignorer les tests vidéo. La simple présence de ce changement ne prouve pas un déploiement ni une CI verte.

## Installation Chromium résiliente sur GitHub Actions (6 novembre 2026)

Le runner GitHub `ubuntu-24.04` possède déjà les bibliothèques système requises par Chromium. L'option `--with-deps` appelait APT et pouvait bloquer la CI sur les miroirs réseau, comme pour FFmpeg. Le workflow met en cache les navigateurs de la version Playwright verrouillée (`@playwright/test 1.64.1`) dans `~/.cache/ms-playwright`, puis exécute `npx playwright install chromium` sans installation APT ni service additionnel, avec une seconde tentative explicite en cas d'échec réseau. Tous les vrais tests E2E Playwright restent bloquants : si les bibliothèques ou le navigateur manquent, le job échoue et la fusion est refusée.
