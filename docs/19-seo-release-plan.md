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
