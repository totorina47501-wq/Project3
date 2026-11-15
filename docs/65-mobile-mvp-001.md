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

## Sous-phase QA offline du 15/11/2026 (issue #140, PR #180)

### Inventaire ecrans Expo/WebView

- Header fixe: titre "MentionCheck mobile" + rappel YouTube-only.
- Onglets WebView: `Connexion`, `Tableau de bord`, `Verifier`, `Historique`, `Mia`, `Studio`, `Compte`.
- WebView securisee: allowlist stricte `mentioncheck.app` + staging, cookies partages, blocage des URL non sures.
- Banniere hors-ligne: message "Connexion indisponible." + action `Reessayer`.
- Footer legal: liens `Confidentialite` et `CGU` ouverts via navigateur OS.

### Inventaire tests avant QA offline

- `tests/unit/mobile-allowlist.test.ts`: normalisation base URL, allowlist origines, filtrage liens externes.

### Tests de non-regression ajoutes dans ce lot

- `tests/unit/mobile-webview-policy.test.ts`: deep link auth autorise sur origines MentionCheck.
- `tests/unit/mobile-webview-policy.test.ts`: navigation Back Android conditionnee a l'historique WebView.
- `tests/unit/mobile-webview-policy.test.ts`: liens externes HTTPS delegues a l'OS uniquement.
- `tests/unit/mobile-webview-policy.test.ts`: blocage des origines/protocoles non autorises.
- `tests/unit/mobile-webview-policy.test.ts`: politique permissions WebView explicite (`prompt`).
- `tests/unit/mobile-webview-policy.test.ts`: affichage hors-ligne explicite (`Connexion indisponible.`).

### Checklist release mobile (AAB/IPA) et recette appareils reels

- [x] QA offline shell mobile + tests unitaires de non-regression.
- [ ] Build signe Android AAB (keystore, versioning, signature verifiee).
- [ ] Build signe iOS IPA/Archive (certificats/profils, signature verifiee).
- [ ] Recette Android sur appareil reel (auth deep link, upload media, liens externes, mode hors-ligne, permissions refusees/acceptees).
- [ ] Recette iOS sur appareil reel (auth deep link, upload media, liens externes, mode hors-ligne, permissions refusees/acceptees).
- [ ] Verification RGPD mobile (export, effacement demande, liens legaux visibles).
- [ ] Verification OAuth YouTube reel sur mobile (si credentials et environnement valides).
- [ ] Soumission stores Apple/Google avec comptes developpeur actifs et validation exploitant.

Etat: publication stores et controle reel restent bloques tant que signatures, comptes developpeur et recette utilisateur ne sont pas fournis.
