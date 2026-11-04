# Livraison interne — 4 novembre 2026

Base comparée : `4f9487d8482294e40b617b9457b2e30b8d0ad190`, branche
`feat/mentioncheck-bloc-1-fondations`, PR #1 uniquement.

Le dépôt existant utilise Next.js 15 / React 19 et Cloudflare/OpenNext. Les
fichiers du socle documentaire local n'ont pas été copiés dans le dépôt.
Le registre `docs/work-registry.json` reste la source d'inventaire des routes
et migrations ; les traitements existants sont prolongés dans leurs modules.

## Périmètre d'exécution

- Collaborations : brouillons, liens possédés, archivage immuable et exports.
- Médias : exécuteur local des processeurs FFmpeg/Sharp déjà présents.
- Studio : équipe, invitations locales, clés API révocables, partage explicite.
- Confidentialité : export paginé, consentement révoqué, préparation dry-run.
- UX : annulation des flux, accessibilité, erreurs et périmètres explicites.
- Vérification : registre, TypeScript, lint, unités, médias réels, Playwright,
  SQL isolé lorsque disponible et compilation Next.js.

## Contraintes de livraison

Aucun appel OpenAI, aucune activation Stripe ou autre fournisseur, aucune suppression en production. La migration interne a ensuite été
appliquée avec autorisation explicite ; voir le relevé de livraison ci-dessous.
Les services applicatifs des tests utilisent des fixtures locales sans secrets.
Un seul commit final sur la branche existante, aucune nouvelle PR ni fusion.

## Plan et interfaces d'intégration

- [x] Prolonger collaborations/archives et vérifier leurs règles d'appartenance.
- [x] Exécuter les médias localement avec reprise, hashes et erreurs contrôlées.
- [x] Ajouter Studio sans exposer l'historique personnel des membres.
- [x] Prolonger export/consentement et garder l'effacement en dry-run.
- [x] Tester les vraies interfaces avec une frontière Supabase HTTP locale.
- [x] Intégrer les migrations à inspecter/appliquer séparément du code.
- [x] Mettre à jour le registre et exécuter tous les contrôles demandés.
- [x] Relire, publier le commit initial puis intégrer les évolutions de main.

Les nouvelles tables Studio et collaborations sont communiquées au module
RGPD. Les mutations SQL requièrent soit l'identité Supabase vérifiée, soit
un appel serveur explicitement autorisé ; aucun rôle n'est issu de métadonnées
utilisateur modifiables. Le backend de fixture est réservé aux tests et n'est
jamais importé par les routes de production.

## Évolution distante observée

La PR #1 a été fusionnée par une action extérieure le 4 novembre 2026 à
14:44:25 UTC, commit de fusion `3e679abe39a29d6a4201a99262259231d0954f16`.
Après autorisation explicite de l’utilisateur, les développements ont été
intégrés à main en préservant les évolutions distantes. Aucun nouveau dépôt
ni nouvelle PR n’a été créé.

## Revue et vérifications

Revue indépendante effectuée sur les domaines ajoutés. Deux défauts ont été
reproduits puis corrigés : invitations d’administrateurs rétrogradés/révoqués
et lecture JSON non bornée dans Studio/API. Les régressions SQL et HTTP couvrent
ces cas. Un émetteur SSE ne tente plus d’écrire après fermeture du navigateur.

Vérifications locales exécutées : 169 tests Vitest, 37 tests médias réels
FFmpeg/Sharp sans skip, 4 suites SQL, 4 tests du harnais SQL, 2 tests de fixture,
registre anti-doublons, TypeScript, lint et compilation Next.js. Les résultats
Playwright et CI définitifs sont fournis avec le SHA de livraison.

La compilation ne télécharge plus Google Fonts : les polices sont intégrées
via Fontsource. Auth/Storage des suites SQL sont simulés, pgcrypto est réel ;
pgvector et les parcours de production restent explicitement hors de cette preuve.

Playwright local : 19/19 réussites, aucun skip, Chromium système. Les 169
tests Vitest restent verts après les correctifs responsive et SSE.

Compatibilité CI : les scripts Node:test emploient le nom expérimental
`--experimental-test-isolation=none`, accepté par Node.js 22 et 24.

Audit npm des dépendances de production : zéro vulnérabilité après
unification de PostCSS sur la version exacte du manifeste. Cet audit est
également exécuté en CI et ne prétend pas couvrir les binaires système.

## Relevé de livraison après intégration

Main de référence : `b8d1a14a96ff9c5cc5f9065b1624b5d4a285a7ea`.
CI GitHub Actions `41889338060` et contrôle Cloudflare réussis sur ce SHA.
La migration `internal_completion` a été appliquée au projet Supabase
`zcztvberuihphqklhjsr`, version distante `20261104184723`, à partir du fichier
`20261104200500_internal_completion.sql`. Ne pas la réappliquer par comparaison
naïve des noms de versions : les migrations historiques MCP portent des
horodatages distants distincts. Vérification distante en lecture seule :
23 tables publiques avec RLS, 8 règles et 5 documents, aucun embedding.

La validation de cette intégration comptait 194 tests unitaires, 46 tests médias,
4 suites SQL et 19 parcours Playwright réussis ; le test Storage réel restait
désactivé car il écrit et supprime des objets distants. Ces chiffres décrivent
ce SHA et ne remplacent pas la validation des commits suivants.

Complément courant : préparation de lots de réécritures hors ligne, documentée
dans [28-training-offline.md](28-training-offline.md), sans entraînement ni
transmission au fournisseur. Consentement, demandes d’effacement, relecture,
coordonnées, secrets et partition par créateur font l’objet de tests dédiés.

Restent à valider/implémenter avant ouverture commerciale : parcours réel
Auth/Storage, facturation des trois offres, transport des emails et OAuth,
exécution média distante, indexation vectorielle du corpus, entraînement et
évaluations des modèles, identité de l’éditeur et textes légaux définitifs,
exécution autorisée des politiques de conservation/effacement. Le réglage
Supabase de protection contre les mots de passe compromis reste désactivé.
Aucun de ces services n’est activé par la préparation locale des données.

Validation du complément hors ligne : TypeScript et lint réussis, 194 tests
unitaires et 15 tests de préparation IA réussis, 46 tests médias, 4 suites SQL,
4 tests de harnais et 2 tests de fixture réussis. Playwright : 19 réussites,
1 test Storage réel volontairement désactivé. Compilation Next.js et bundle
OpenNext réussis. Aucun nouveau schéma distant ni service activé.
