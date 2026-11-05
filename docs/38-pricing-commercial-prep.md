# Pricing MentionCheck — préparation commerciale (5 novembre 2026)

La page `/tarifs` présente les offres Solo (9 €), Pro (19 €) et Studio (49 €) par mois, à titre indicatif. Elle reste `noindex` tant que la commercialisation n'est pas autorisée. L'offre Pro est mise en avant sans promesse de performance ni mention de popularité non prouvée.

## Source de vérité et garde-fous
- Prix et quotas d'analyses : `lib/branding.ts`.
- Autres quotas de présentation : `app/tarifs/page.tsx` ; les confirmer avec les contrôles serveur avant toute vente.
- Paiement : le composant Stripe existant n'est affiché que si la porte de test l'autorise. Aucun paiement live n'est activé.
- Les tarifs, la fiscalité, les conditions d'abonnement, les droits des consommateurs et les quotas contractuels doivent être validés avant ouverture.
- MentionCheck fournit une aide à la vérification, non un conseil juridique.

## Vérifications avant lancement
1. Comparer chaque quota affiché aux quotas effectivement appliqués côté serveur.
2. Vérifier les parcours clavier, mobile, lecteur d'écran et la lisibilité du tableau horizontal.
3. Vérifier Stripe en bac à sable, y compris Solo, sans déclencher de paiement réel.
4. Confirmer prix TTC/HT, facturation, renouvellement, résiliation et CGV.
5. Autoriser l'indexation SEO seulement lorsque les offres sont réellement disponibles.
