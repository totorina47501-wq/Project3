# SaaS Factory — plan d'industrialisation à partir de Project3

## Principe

`Project3` reste le produit **MentionCheck** et la référence de qualité technique. La future usine `SaaS-Factory` sera un dépôt **séparé**, contenant un modèle neutre, un générateur de nouveaux projets, les consignes agents et les workflows réutilisables. Ne jamais dupliquer la base de production, les clés, les domaines, les comptes, le contenu juridique ni les modules métier.

## Éléments réutilisables après extraction et revue

| Socle | Source de référence | Adaptation indispensable |
| --- | --- | --- |
| Next.js / TypeScript | package.json, tsconfig.json, app | Retirer écrans et branding MentionCheck |
| Auth / RLS | lib/security, supabase/migrations | Reconcevoir les tables et politiques pour le nouveau domaine |
| UI responsive | components, styles | Créer des composants génériques sans mentions légales métier |
| API versionnée | app/api/v1, docs/08-studio.md | Générer contrats propres à chaque SaaS |
| Paiements | lib/billing, Stripe tests | Mode test uniquement, aucun prix ni secret hérité |
| Tests | tests/unit, tests/e2e, scripts | Réutiliser le harnais, pas les fixtures métier |
| CI/CD | .github/workflows/ci.yml | Reparamétrer sans hériter des secrets Cloudflare |
| SEO/i18n | app, docs | Domaine, langues, sitemap et marque propres au nouveau projet |

Exclure **Mia, RAG, embeddings, corpus juridique, règles de conformité, données privées, identifiants Supabase, URLs Cloudflare, configurations de déploiement et secrets**. L'extraction doit se faire par sélection explicite, jamais par duplication intégrale du dépôt.

## Contrat du générateur cible

Entrées : `project_slug`, `product_name`, `domain`, `languages`, `modules` (auth, billing-test, ai-disabled, api, media), `deployment_target`. Valider les noms, rejeter les chemins hors dépôt, ne jamais générer de secrets. Sorties : dépôt isolé, `.env.example`, README, CI hors réseau, tests et checklist d'activation des fournisseurs.

## Automatisation GitHub : pilote de sécurité

Le workflow `.github/workflows/factory-safe-automerge.yml` ne fusionne **que** si :
- la CI complète `MentionCheck CI` réussit sur une PR non brouillon, issue du même dépôt, ciblant `main` ;
- le SHA exact de la PR correspond à celui du run et n'a pas changé ;
- les jobs `quality` et `Image du runner média (sans fournisseur)` réussissent ;
- la PR porte **explicitement** le label `factory:auto-merge-safe` ;
- **tous** les fichiers modifiés sont des `docs/*.md` ou `docs/*/*.md` non sensibles.

Aucune PR actuelle n'a ce label. Pas de fusion rétroactive des PR #31 ou #34. Aucune modification d'auth, RLS, migrations, paiement, Mia, API, code de production, dépendances ou workflows n'est autorisée en auto-merge.

**Attention :** GitHub Actions utilisant `workflow_run` et `GITHUB_TOKEN` ne peut pas contourner les protections de branche. Si la politique du dépôt exige des revues, la fusion échoue normalement. Le workflow ne lance pas de code issu de la PR, ne déploie pas et ne lance pas d'API IA. La CI et les protections GitHub restent la source de vérité. Le label d'opt-in doit être réservé aux responsables de confiance ; ne pas l'ajouter automatiquement à toute issue.

## Séquence de déploiement de l'usine

1. Fusionner le pilote après revue de sécurité et CI verte.
2. Tester le label sur une nouvelle PR documentaire volontairement créée à cet effet ; vérifier les refus (PR brouillon, changement de SHA, fichier non autorisé, CI KO).
3. Mesurer la consommation de minutes Actions et crédits Copilot.
4. Créer le dépôt indépendant `SaaS-Factory`, y ajouter un générateur sans secret et une CI.
5. Automatiser la création des issues et leur affectation Copilot, **uniquement** après vérification des capacités et permissions du compte ; ne pas supposer que l'API d'assignation Copilot fonctionne comme un utilisateur ordinaire.
6. Mettre en place des règles de déploiement, quotas et arrêt d'urgence avant d'étendre l'auto-merge à des fichiers exécutables.

## Commande de contrôle

Ouvrir `Actions > MentionCheck CI` et `Actions > Safe documentation auto-merge`. Les résultats de la CI d'une PR ne prouvent ni sa fusion, ni son déploiement, ni son bon fonctionnement en production.
