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

Aucun appel OpenAI, aucune activation Stripe ou autre fournisseur, aucune
migration appliquée à une base distante, aucune suppression en production.
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
- [ ] Relire la différence complète, créer et publier le commit unique.

Les nouvelles tables Studio et collaborations sont communiquées au module
RGPD. Les mutations SQL requièrent soit l'identité Supabase vérifiée, soit
un appel serveur explicitement autorisé ; aucun rôle n'est issu de métadonnées
utilisateur modifiables. Le backend de fixture est réservé aux tests et n'est
jamais importé par les routes de production.

## Évolution distante observée

La PR #1 a été fusionnée par une action extérieure le 4 novembre 2026 à
14:44:25 UTC, commit de fusion `3e679abe39a29d6a4201a99262259231d0954f16`.
Le présent travail ne fusionne pas main et ne crée ni branche ni PR. La branche
existante reste la destination du commit. La CI accepte également son push
car une PR déjà fusionnée ne peut plus déclencher la validation du nouveau SHA.

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
