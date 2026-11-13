# MentionCheck Mobile (Expo MVP)

Application mobile compilee Android/iOS pour reutiliser le backend MentionCheck
sans dupliquer les algorithmes metier.

## Scope MVP

- Shell mobile Expo + React Native.
- Navigation par onglets vers les parcours web existants.
- Allowlist stricte des origines MentionCheck.
- YouTube uniquement cote social OAuth (heritage backend).
- Liens RGPD et legal accessibles dans l'application.

## Configuration

Variable optionnelle:

- `EXPO_PUBLIC_MENTIONCHECK_BASE_URL` (par defaut `https://mentioncheck.app`)

## Run local

```bash
cd apps/mobile
npm install
npm run start
```

## Security notes

- Aucune cle `service_role`, secret Stripe/Google ou token OAuth dans le bundle.
- Le shell bloque la navigation integree hors allowlist et ouvre les URL externes
  via le navigateur OS.
