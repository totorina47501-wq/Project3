# Bloc 4 — Mia conversationnelle, archives et PDF

**État :** code préparé sur la branche de développement, migration Supabase appliquée, déploiement Cloudflare et vérifications E2E authentifiées restant à confirmer.

## Fonctionnalités

Mia : page /dashboard/mia avec dialogues privés, historique, suppression,
références juridiques consultées et contexte d'une vérification personnelle.
Les réponses ne remplacent jamais un avis juridique.

RAG documentaire v1 : cinq synthèses du seed, classement lexical côté serveur.
Les références affichées sont filtrées sur Legifrance et economie.gouv.fr.
**Aucune indexation pgvector n'est encore active : 0/5 embeddings.** Ne pas
présenter la recherche lexicale comme une recherche vectorielle déjà opérationnelle.

Quotas : Solo 20 messages/mois, Pro 300, Studio 1500, contrôlés
transactionnellement dans PostgreSQL. Quota remboursé si l'appel ou
la sauvegarde échoue. Maximum 40 messages par discussion.
La fonction SQL append_mia_exchange est réservée au service_role et
garantit un append atomique pour éviter les écrasements concurrents.

Archives : page /dashboard/archive, détail /dashboard/archive/[id],
et export privé /api/archive/[id]/pdf. Les URLs sont liées à l'utilisateur
authentifié et protégées par RLS. Le PDF contient original, texte accepté,
statut, score, anomalies et empreinte SHA-256 enregistrée. Il ne constitue
ni une signature électronique qualifiée ni un horodatage de confiance.

## Migrations et configuration

Migration 202611042001_mia_quota_and_append.sql appliquée à Supabase.
Les quatre variables Cloudflare existantes suffisent. Conserver la clé
Supabase administrative et la clé OpenAI uniquement comme secrets serveur.

## Vérifications

- TypeScript strict, ESLint, tests Vitest de recherche documentaire et PDF.
- Playwright invité : accès privé redirigé vers connexion et API 401.
- Playwright authentifié : opt-in avec E2E_TEST_EMAIL et E2E_TEST_PASSWORD
  (secrets de test hors GitHub). Aucun appel IA payant pendant le smoke.
- À confirmer sur le Worker : connexion, Mia avec source, historique,
  suppression, PDF et isolation entre deux comptes.

## Sujets ultérieurs

Indexer les cinq documents avec text-embedding-3-small et contrôler la
pertinence avant de passer à la recherche pgvector/hybride. Compléter les
tests de médias, la vidéo isolée, Stripe (mode test), Resend, l'effacement
RGPD et la conformité avant commercialisation.
