SEO MentionCheck — préparation

Statut : plan non déployé.

- Conserver le sitemap limité aux pages publiques effectivement prêtes.
- Garder /dashboard, /api et les offres non commercialisées hors indexation.
- Vérifier NEXT_PUBLIC_APP_URL et les URL canoniques avant toute mise en ligne.
- Préparer des tests unitaires pour robots et sitemap.
- Vérifier les métadonnées Open Graph et la langue française.
- Ne pas publier de promesses de certification juridique.

## Lot SEO éditorial — 5 novembre 2026

- Accueil enrichi pour créateurs, influenceurs et freelances ; aucun nouveau service ni promesse de conformité garantie.
- Lien vers les tarifs indicatifs, qui restent `noindex` et exclus de `robots.txt`.
- Canonical de l'accueil basé sur `publicSiteUrl()` et `metadataBase` ; pas de redirection vers un domaine non vérifié.
- Métadonnées Open Graph cohérentes avec la proposition de valeur.
- Test Playwright de l'accueil et du canonical ajouté au test existant.
- Avant lancement : confirmer domaine, coordonnées légales, consentement et Search Console ; ne pas modifier les accès privés ni ouvrir Stripe live.

## Audit SEO hors ligne — 6 novembre 2026

- Le canonical est déclaré uniquement sur l’accueil ; les pages tarifs et privées ne récupèrent plus son URL.
- L’URL Open Graph fixe de l’accueil a été retirée des métadonnées globales afin de ne pas la propager aux autres routes.
- `robots.txt` interdit aussi `/dashboard` sans slash, en plus de ses sous-routes ; les tarifs restent exclus du sitemap et `noindex`.
- Playwright vérifie le canonical de l’accueil, son absence sur les tarifs, les règles robots et l’unicité de l’URL du sitemap.
- Les contrôles clavier/mobile existants restent couverts par `tests/e2e/authenticated-navigation.spec.ts` ; aucune refonte UI n’est requise par cet audit.
- Le build local de cette révision mesure l’accueil à 185 B et 106 kB de JavaScript au premier chargement (103 kB partagés). Aucun défaut de bundle supplémentaire n’est établi ; aucun code client n’a été modifié.

## Préparation éditoriale et vérification landing — 9 novembre 2026

- `docs/marketing/guide-mentions-commerciales-influence.md` est un brouillon interne daté, fondé sur des sources officielles et explicitement soumis à validation juridique avant toute diffusion.
- Le guide n’est pas publié, n’est pas lié depuis la landing et ne constitue ni un avis juridique ni une certification de conformité.
- Les tests Playwright existants de landing vérifient les CTA, le caractère indicatif des tarifs, l’absence de collecte et de requêtes tierces sur l’accueil, la navigation clavier/mobile et les liens légaux.
- Aucun formulaire de prospect, tracker, intégration SaaS Factory, attribution ou CRM n’est ajouté ; le canonical et le sitemap existants restent inchangés.
