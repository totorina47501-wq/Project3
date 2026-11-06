# Livraison intégrée du 6 novembre 2026

Base comparée : `abcdb79`, comprenant les 11 commits Copilot ajoutés depuis `cb5d096`. Les ajouts SDK/API, navigation mobile, tests RGPD et workflows agents sont conservés. La PR #34 (liens Markdown) reste hors périmètre.

## Code livré

- Préparation média inchangée dans son principe sans IA ; action IA explicite distincte, intégrité avant transmission, contexte multimodal, transcription facultative, coûts et quotas, historique et export personnel.
- Reprises Storage transitoires, contrôles de bail, taille, hash et isolation des secrets : 18 nouvelles régressions média.
- Import juridique approuvé avec snapshot transactionnel et journal ; corpus paginé, indexation cinq documents maximum par action. Aucun nouveau texte importé.
- Quotas affichés depuis les droits existants, diagnostic commercial sans secrets, emails prévisualisables, webhook transactionnel sans activation Stripe.

## Vérifications locales

TypeScript, lint, 337 tests unitaires, 90 tests médias (27 vidéo, 4 carrousel, 59 jobs), 25 tests corpus, 11 suites SQL sur 17 migrations compatibles PGlite, 4 tests du harnais, 7 tests RGPD, 22 préparation IA, 6 fixtures HTTP et le registre passent. Playwright : 24 réussis, 1 ignoré, flags médias activés ; le scénario IA intercepte HTTP sans appeler OpenAI. Les premières exécutions concurrentes ont subi des délais de chargement ; la suite entière passe avec un navigateur. La configuration borne désormais le parallélisme et tolère la compilation Next dev dans les assertions.

Build Next.js, bundle OpenNext et dry-run Wrangler réussis. Ces preuves locales ne remplacent pas les checks GitHub du SHA publié ni une recette IA réelle de la nouvelle route.

## Base distante

Trois migrations additives appliquées au projet existant, aucune suppression :

| Fichier source | Version distante |
|---|---|
| 20261105120000_law_controlled_import.sql | 20261106010057 |
| 20261105121000_prepared_media_ai.sql | 20261106010100 |
| 20261105122000_billing_atomic_sync.sql | 20261106010102 |

RLS vérifiée sur les deux nouvelles tables, INSERT refusé au rôle authenticated. Le corpus reste à cinq documents, aucun abonnement n'existait avant migration. Les avertissements sécurité existants restent cinq RPC authentifiées intentionnelles et la protection contre mots de passe compromis désactivée ; le journal d'import est privé service-only et explique un nouvel INFO sans policy.

## Activation et preuves distantes

Les flags média IA et disponibilité du schéma sont déclarés dans Wrangler, sans remplacer les clés runtime existantes. Aucun paiement, email ni appel OpenAI réel dans les tests locaux. Audio désactivé par défaut ; activation et recette audio réelles restent distinctes.

Les checks et déploiements sont attachés au commit contenant ce document. Une éventuelle recette multimodale après déploiement laisse ses preuves dans media_ai_runs et ai_analyses ; les vérifier avant tout nouvel appel payant. Réutiliser les deux préparations synthétiques recensées dans docs/receipts/2026-11-05-cloudflare-media.json, sans téléverser à nouveau ni recréer une clé.
