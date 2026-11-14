# MOBILE-001 - Discovery et MVP mobile Android/iOS

Issue de reference: #140 (branche/PR dediee #142).

## Inventaire anti-doublons

- Aucune application mobile installable existante n'etait presente dans le depot.
- Le code web Next.js existant couvre deja auth, dashboard, check, archives, Mia, Studio et compte.
- Une PR mobile dediee existe (`codex/totorina47501-wqproject3-140-create-mobile-app`), sans fichiers metier en doublon avant ce lot.
- Les routes/API/backend ont ete reutilises sans nouvelle logique metier ni migration SQL.

## Decision d'architecture

Comparaison rapide:

- Expo/React Native: binaire Android+iOS unique, packaging mobile standard, extension native possible pour permissions/media.
- Capacitor/PWA: faible effort initial mais dependance plus forte au runtime web et ergonomie native plus limitee.

Decision MVP:

- Expo + React Native, avec shell WebView securise pointant vers MentionCheck.
- Motivation: livrer un binaire mobile rapidement sans dupliquer les algorithmes backend ni bloquer le chantier web.

## Perimetre MVP code

- Navigation mobile par onglets vers les parcours web deja disponibles.
- Allowlist stricte des origines `mentioncheck.app` et staging.
- Liens legaux/RGPD visibles depuis l'app.
- Mention explicite YouTube-only pour l'OAuth social (les autres reseaux restent hors phase 1).

## Hors perimetre de ce lot

- Publication stores (App Store / Play Store).
- Paiement in-app.
- Reimplementation native des algorithmes de conformite.
- Activation de services payants ou modification backend.
