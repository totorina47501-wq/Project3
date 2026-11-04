# Bloc 4 — Mia conversationnelle, archives et PDF

**État :** Mia lexical intégré à main ; RAG hybride préparé sur branche, désactivé par défaut ; indexation et E2E authentifiés à confirmer.

## Fonctionnalités

Mia : page /dashboard/mia avec dialogues privés, historique, suppression,
références juridiques consultées et contexte d'une vérification personnelle.
Les réponses ne remplacent jamais un avis juridique.

RAG documentaire v1 : cinq synthèses du seed, classement lexical côté serveur.
Les références affichées sont filtrées sur Legifrance et economie.gouv.fr.
**Vérification Supabase du 4 novembre 2026 : 0/5 embeddings.** Colonne vector(1536), index HNSW et fonction match_law_documents déjà présents et réutilisés. Le mode hybride ne sera actif qu'après indexation complète et autorisation explicite.

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
pertinence avant d'activer la recherche vectorielle/hybride. Compléter les
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

## Lot de fiabilisation Mia hors ligne

- La récupération documentaire rejette les sources vides, les références malformées, les URL non HTTPS, les domaines non autorisés et les URL avec identifiants.
- Quand aucune synthèse pertinente n'est disponible, Mia renvoie une réponse prudente **sans appeler OpenAI**, sans citer d'article et avec consommation IA estimée à zéro. Les quotas applicatifs existants restent gérés par la route.
- Tests de validation documentaire et de question hors corpus ajoutés. Aucune indexation vectorielle ni changement de schéma SQL dans ce lot.
- L'indexation pgvector, les tests authentifiés sur Cloudflare et l'évaluation juridique restent à valider séparément.


## RAG hybride pgvector — raccordement sans doublons

La colonne `law_documents.embedding` (1536 dimensions), l'index HNSW, la RPC
`public.match_law_documents` (service_role uniquement) et le client existant
`generateLegalEmbedding` sont réutilisés. Aucune nouvelle table ou migration.

**Garde-fous et activation :**

- Lexical par défaut, aucune facturation nouvelle.
- Vectoriel seulement avec `MIA_VECTOR_SEARCH_ENABLED=true`,
  `OPENAI_EMBEDDINGS_ENABLED=true`, une clé OpenAI côté serveur et sans pause.
- Vérification systématique de l'indexation intégrale avec le bon modèle ;
  si index partiel, modèle divergent, lecture tronquée ou document non valide :
  retour lexical **avant tout appel d'embedding**.
- Pour le corpus intégral, appel d'embedding de la question, RPC pgvector
  avec seuil de similarité cosinus 0,78, classement hybride lexical/vectoriel,
  au plus quatre références officielles. Les références et URL sont
  recoupées avec les entrées validées, jamais acceptées aveuglément du RPC.
- En cas d'erreur vectorielle, retour lexical ; aucun contenu personnel
  n'est enregistré dans les logs.

**Indexation opérateur, hors Worker :**

1. Aperçu sans aucune requête payante :
   `node scripts/mia/index-law-vectors.mjs`
2. Après approbation explicite d'appels OpenAI facturés, fournir les secrets
   serveur `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_KEY` et
   `OPENAI_API_KEY`, puis exécuter :
   `MIA_INDEX_APPROVED=true OPENAI_EMBEDDINGS_ENABLED=true node scripts/mia/index-law-vectors.mjs --execute`
3. L'indexeur est idempotent, vérifie les URL officielles, traite au plus
   30 documents et refuse une lecture tronquée. Aucun secret n'est journalisé.
4. Vérifier la couverture réelle dans Supabase :
   `select count(*) as total, count(embedding) as indexed from public.law_documents;`
   Vérifier aussi le modèle et les réponses de `match_law_documents`, puis
   seulement activer les deux drapeaux côté Worker.

Chaque question vectorielle activée consomme des tokens embeddings, en plus
des tokens du chat ; aucun appel payant n'est effectué en CI. Les tests ajoutés
couvrent le classement, les faux positifs, la sécurité des URL, les sources
inconnues, la couverture partielle et l'aide CLI sans secrets. Les E2E authentifiés
et la validation de qualité métier en production restent à réaliser.


## Indexation one-shot depuis le Worker existant

La route `POST /api/internal/mia-index` réutilise les secrets serveur du Worker
et ne crée aucun doublon SQL. Elle exige un jeton Bearer d'au moins 32 caractères :
`MIA_INDEX_TOKEN` si configuré, sinon `MEDIA_RETENTION_TOKEN` déjà présent.
Le jeton n'est jamais retourné ni journalisé.

- `POST /api/internal/mia-index` : aperçu (dry-run) du nombre de vecteurs manquants.
- `POST /api/internal/mia-index?execute=true` : au plus cinq embeddings sur le
  corpus validé, uniquement avec `OPENAI_EMBEDDINGS_ENABLED=true` et une clé OpenAI
  valide ; aucune opération si `OPENAI_PAUSED=true`.
- Chaque ligne est écrite avec vérification du contenu initial ; l'indexation
  saute les documents déjà indexés. Le résultat indique la couverture 5/5,
  mais n'active jamais `MIA_VECTOR_SEARCH_ENABLED` automatiquement.
- Si les drapeaux d'embeddings sont désactivés côté Worker, l'exécution
  est refusée sans facturation. Le jeton ne doit jamais être mis dans une URL,
  une commande GitHub Actions ou un log. Utiliser une requête HTTPS
  authentifiée depuis un terminal privé.
- Une fois la couverture confirmée et les tests de pertinence validés,
  désactiver `OPENAI_EMBEDDINGS_ENABLED` si le vectoriel ne doit pas servir
  les requêtes utilisateurs, et retirer le jeton d'indexation dédié s'il a été créé.

La CI n'appelle pas cette route et n'exécute aucune requête OpenAI payante.

## Déploiement et indexation Mia sur Cloudflare

Le déploiement de MentionCheck est déjà géré par l'intégration GitHub
native de Cloudflare à chaque fusion sur `main`. Ne pas ajouter un
second workflow de déploiement GitHub Actions ni recopier les secrets
d'exécution Cloudflare dans GitHub.

L'endpoint `POST /api/internal/mia-index` est conservé sur le Worker.
Il exige un jeton opérateur côté Cloudflare (`MIA_INDEX_TOKEN` ou
`MEDIA_RETENTION_TOKEN`, 32 caractères minimum). L'appel sans paramètre
effectue un aperçu sans consommation OpenAI. `?execute=true` déclenche
une indexation idempotente de cinq documents uniquement si
`OPENAI_EMBEDDINGS_ENABLED=true`, `OPENAI_PAUSED` différent de
`true`, et les clés OpenAI et Supabase sont présentes côté Worker.

L'appel d'administration doit être effectué depuis un environnement
opérateur sécurisé, sans placer le jeton dans le dépôt, les logs ou
l'URL. Vérifier ensuite dans Supabase :
`SELECT COUNT(*) AS documents, COUNT(embedding) AS indexed FROM public.law_documents;`
Résultat attendu : 5 / 5. Ne pas activer
`MIA_VECTOR_SEARCH_ENABLED` avant validation des cinq vecteurs et
un test de pertinence du RAG.
