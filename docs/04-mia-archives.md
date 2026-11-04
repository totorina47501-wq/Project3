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

## Complément interne — collaborations commerciales et registre

Le code de `/dashboard/brand-deals` étend la table `brand_deals` existante :
création, lecture, modification et suppression des brouillons personnels,
recherche par marque, filtre brouillon/archivé, pagination de 20 lignes avec
décompte exact. Les écritures demandent une session et une origine identique.
Le serveur n'accepte aucun `user_id`, hash ou horodatage fourni par le client.
Les identifiants de vérifications sont saisis dans le formulaire et vérifiés
par la base ; 50 liens maximum, tous possédés par le même utilisateur.

L'archivage transactionnel verrouille la collaboration et les vérifications
liées. Une vérification liée doit être finalisée (`completed`, `accepted`,
`kept`) et posséder son empreinte. La marque, les dates, le chemin de contrat,
les liens et les textes sont copiés dans un snapshot `archive_payload` versionné.
PostgreSQL calcule le SHA-256 de son texte JSONB UTF-8 et enregistre l'heure UTC
interne. Un second appel conserve l'archive initiale. Toute modification d'une
ligne archivée ou de ses liens est refusée ; les RPC ne suppriment que des
brouillons. L'effacement administratif du compte reste un chantier RGPD séparé.

Le format canonique v1 est un tableau JSON : version, identifiant de
collaboration, propriétaire, marque, début, fin, chemin de contrat, création
UTC, archivage UTC, puis les vérifications triées par UUID. Chaque vérification
contient UUID, plateforme, statut, texte original, texte accepté, empreinte et
version du moteur. Le texte canonique utilise les espaces JSONB après les
virgules ; dates UTC au format milliseconde. Le snapshot couvre ces valeurs,
**pas les octets d'un contrat ou d'un média**. Aucun prestataire d'horodatage,
aucune signature électronique qualifiée et aucun certificat juridique ne sont
émis. Les archives historiques sans snapshot restent affichables et signalées.

Les routes `/api/brand-deals`, `/api/brand-deals/[id]`,
`/api/brand-deals/[id]/archive` et `/api/brand-deals/export` sont privées.
Les exports JSON/CSV/PDF portent sur les métadonnées du registre filtré,
limité à 500 collaborations ; un résultat tronqué est refusé explicitement,
jamais présenté comme complet. Le CSV protège contre les formules de tableur.
Le JSON décrit ses limites ; les snapshots complets sont consultables
individuellement via le détail privé. Le PDF historique de vérification est
conservé. Aucun téléversement de contrat supplémentaire n'est implémenté : les
chemins éventuels sont contrôlés dans le bucket privé `deal-contracts` existant.

Les archives de vérifications ajoutent recherche dans le texte, plateforme,
statut et intervalle de dates UTC validé. Les filtres sont conservés dans les
liens de pagination ; les lectures incluent explicitement le propriétaire en
plus des RLS. Une erreur de lecture n'affiche pas un faux total zéro.

**Limites opérationnelles :** complément SQL à intégrer dans une migration
finale avant utilisation des collaborations ; aucune application distante ni
preuve E2E authentifiée fournie par ce chantier. Le test SQL
`tests/sql/collaborations_security.sql` est réservé à une base locale jetable et
annule sa transaction. Il a été exécuté hors ligne avec PostgreSQL WASM PGlite
et pgcrypto réel : les RPC, RLS, liens possédés, archivage idempotent, empreinte
canonique et immutabilité ont été vérifiés. Le bootstrap local simule uniquement
Auth/Storage et omet le champ/index vectoriel sans lien avec ce domaine.
Les tests Vitest couvrent validation, isolation des routes, CSRF, limites
honnêtes des exports, canonicalisation/empreinte et PDF ; ils ne prouvent pas
les garanties transactionnelles d'une base déployée. Les collaborations restent
personnelles (`user_id`) ; aucun partage Studio implicite n'est accordé.

## Garde-fou de pertinence documentaire

La sélection lexicale exclut désormais les articles sans aucun recoupement de mots-clés avec la question. Une question hors corpus produit une liste vide plutôt que des références arbitraires ; le prompt de Mia demande explicitement de reconnaître l'absence de sources. Test de non-pertinence ajouté. Cette protection ne remplace pas la validation E2E authentifiée ni l'indexation vectorielle, qui restent à faire avant de qualifier Mia de RAG hybride opérationnel.
