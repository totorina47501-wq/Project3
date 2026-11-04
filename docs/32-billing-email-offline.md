# Trois offres et emails en simulation locale

`lib/billing/plans.ts` centralise les droits de Solo, Pro et Studio et les
prix publics issus du branding (9/19/49 €). Les plafonds de fair-use et quotas
existants sont conservés. Ces helpers ne modifient aucun abonnement réel.

`createBillingSimulation` accepte un compte local, un client fictif et une
table de prix fictifs `solo` (optionnel pour compatibilité), `pro`, `studio`.
Son parser refuse les événements live, prix multiples/inconnus, client tiers
et collisions d’identifiant. Les événements dupliqués, périmés, ambigus ou
d’une ancienne souscription ne peuvent ressusciter des droits annulés.
Les changements locaux de profil et de droits sont atomiques en mémoire ;
un downgrade garde l’usage déjà consommé. `chargedCents` reste toujours zéro.

Le checkout/webhook fournisseur existant reste inchangé et désactivé. Cette
simulation ne prouve ni webhook live, prorata, TVA, encaissement ou transaction
distante du profil et de l’abonnement.

`lib/email/simulation.ts` réutilise les templates français existants et ajoute les variantes alerte,
bilan mensuel et confirmation d’offre.
Son outbox accepte des identifiants de destinataires locaux, sans adresse
de livraison. Seuls les transports créés par la fabrique locale gelée sont
admis ; aucun callback fournisseur arbitraire n’est exécuté. Le transport
enregistre les rendus en mémoire sans les envoyer. Clé idempotente, tentatives
bornées et perte d’accusé après enregistrement sont testées : une reprise ne
produit pas une seconde livraison simulée. Aucun SDK Resend n’est appelé.

```sh
npm test -- --run tests/unit/billing-simulation.test.ts tests/unit/email-simulation.test.ts
```
