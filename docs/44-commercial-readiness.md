# Préparation commerciale interne — 5 novembre 2026

Ce lot complète le code existant sans ouvrir les ventes. Aucun secret, plan
utilisateur, paramètre distant, domaine email ou autorisation OAuth n’est changé.
Aucun client Stripe/Resend n’a été appelé pour cette validation.

## Comparaison avec l’existant et périmètre livré

Le dépôt disposait déjà des droits Solo/Pro/Studio, des simulations de
facturation et d’outbox, de trois routes Stripe en mode test, de sept modèles
d’emails et de pages légales provisoires. Ces fonctionnalités sont conservées.

- `/tarifs` utilise désormais les quotas de `lib/billing/plans.ts`, déjà utilisés
  par la simulation, au lieu de recopier les limites. Les montants restent ceux
  de `lib/branding.ts` et demeurent indicatifs.
- Le tableau précise les comptes **déclarés manuellement**, les **cinq sièges
  Studio, propriétaire compris**, et l’**API de contrôle sans IA**. Le rapport
  Studio porte sur les contrôles explicitement partagés ; aucune certification
  de brand safety n’est annoncée.
- `emailPreviews` expose les sept rendus déjà implémentés : accueil, rapport
  disponible, quota, demande d’effacement, alerte, bilan et abonnement enregistré.
  Les trois derniers étaient absents de la prévisualisation. Il n’existe toujours
  aucun transport email fournisseur.
- Le webhook ignore la suppression d’un abonnement qui n’est plus celui du
  compte. La mutation répète la condition `user_id + stripe_subscription_id` ;
  si la ligne a été remplacée entre lecture et écriture, les droits ne sont pas
  rétrogradés. Un événement `livemode` est refusé avant accès aux données.
- Les échéances Stripe proviennent des items du SDK récent. Le champ historique
  est utilisé en repli. En cas de périodes multiples, l’échéance la plus proche
  est retenue ; une date absente ou invalide donne `null`.

## Prix et limites constatés dans le code

| Offre | Prix mensuel indicatif | Analyses IA | Réécritures | Questions Mia | Comptes déclarés | Studio |
|---|---:|---:|---:|---:|---|---|
| Solo | 9 € | 30 | 5 | 20 | 3 | Espace individuel |
| Pro | 19 € | 500 | 500 | 300 | Sans plafond de déclarations | Espace individuel |
| Studio | 49 € | 2 000 | 2 000 | 1 500 | Sans plafond de déclarations | 5 sièges, propriétaire compris |

Les quotas concordent avec `consume_usage_quota` dans les migrations SQL.
Cette comparaison du dépôt ne prouve pas l’état d’une base distante. Un plafond
mensuel s’applique aussi à Pro et Studio ; aucun « illimité » n’est promis ici.
L’affichage HT/TTC et les règles de TVA ne sont pas établis par le code.

## Diagnostic déterministe

`lib/billing/readiness.ts` expose :

```ts
import { assessCommercialReadiness } from '@/lib/billing/readiness';

// Appel serveur interne : ne jamais exposer process.env au navigateur.
const report = assessCommercialReadiness({ environment: process.env });
const missing = report.checks.filter(check => check.status !== 'present');
// report.readyForReview : tous les champs et références requis sont présents.
// report.canOpenCommercial : false dans cette version, même si le dossier est complet.
// missing : chemins, libellés et actions ; aucune valeur personnelle ni clé.
```

La fonction ne lit pas elle-même l’environnement, n’instancie aucun SDK,
n’envoie aucune requête et ne modifie aucun flag. Avec la même entrée, elle
retourne la même sortie. `present` signifie uniquement « renseigné dans un
format accepté ». Le diagnostic ne vérifie ni l’identité de l’éditeur, ni le
contenu des contrats, ni la propriété d’une clé, ni le montant effectif d’un
tarif Stripe. Une référence de revue doit correspondre à un document réel,
conservé dans un espace opérateur privé.

`BILLING_ENABLED=false` est compatible avec un dossier prêt pour revue.
Le diagnostic ne demande jamais de passer ce flag à `true`. Lorsqu’il est déjà
actif avec une configuration admissible, le résultat indique `test-only`.
Une clé `sk_live_…` ne débloque aucun paiement.

## Champs exacts à renseigner dans le dossier opérateur

Le nom commercial MentionCheck ou la marque MentionCheckIA ne permet pas
d’identifier à lui seul la personne qui exploite le service. Aucune identité
juridique n’est inventée dans cette livraison.

| Champ d’entrée | Texte et donnée à fournir |
|---|---|
| `publisher.legalName` | Raison sociale complète ou nom de l’exploitant réel. |
| `publisher.legalForm` | Forme juridique réelle. |
| `publisher.registeredOffice` | Adresse professionnelle publiable. |
| `publisher.registration` | Immatriculation et registre compétent applicables. |
| `publisher.contactEmail` | Adresse officielle surveillée. |
| `publisher.publicationDirector` | Nom du responsable de publication. |
| `terms.version` | Référence de la version contractuelle approuvée et effectivement publiée. |
| `terms.taxDisplay` | `ttc` ou `ht`, après confirmation du public visé et de la fiscalité. |
| `terms.cancellationPolicy` | Modalités de résiliation, renouvellement et parcours effectif. |
| `terms.withdrawalPolicy` | Règles de rétractation applicables à la clientèle retenue. |
| `terms.disputeResolution` | Contact de réclamation et règlement des litiges applicable. |
| `privacy.version` | Référence de la politique publiée correspondant aux traitements activés. |
| `privacy.contactEmail` | Adresse surveillée pour les demandes de droits. |
| `privacy.retentionSchedule` | Matrice des durées : compte, légendes, médias, conversations, consentements, facturation, journaux et sauvegardes. |
| `privacy.erasureProcedure` | Procédure revue couvrant inventaire, conservation légale, fichiers, prestataires, comptes et preuve de traitement. |
| `privacy.processingRegister` | Registre des finalités, bases légales, destinataires, durées et droits. |
| `reviews.legal` | Référence de revue des mentions légales, conditions, prix, limites et promesses. |
| `reviews.cloudflareDpa` | Référence de revue du contrat Cloudflare pour les services réellement utilisés. |
| `reviews.supabaseDpa` | Référence de revue Supabase, région et sauvegardes. |
| `reviews.openaiDpa` | Référence de revue du contrat API OpenAI, conservation fournisseur et transferts. |
| `reviews.transfers` | Garanties et analyse des transferts internationaux applicables. |
| `reviews.billingSandbox` | Reçu de recette Stripe : souscription, changement d’offre, échec, annulation et événements rejoués. |
| `environment.NEXT_PUBLIC_APP_URL` | Origine HTTPS canonique seule. |
| `environment.STRIPE_MODE` | `test` uniquement. |
| `environment.STRIPE_SECRET_KEY` | Clé de test dans le gestionnaire de secrets ; jamais dans le dossier ou le dépôt. |
| `environment.STRIPE_WEBHOOK_SECRET` | Secret de signature de l’endpoint de test, dans le gestionnaire de secrets. |
| `environment.STRIPE_PRICE_SOLO` | Identifiant distinct du tarif Solo de test. |
| `environment.STRIPE_PRICE_PRO` | Identifiant distinct du tarif Pro de test. |
| `environment.STRIPE_PRICE_STUDIO` | Identifiant distinct du tarif Studio de test. |

Textes de coordonnées à finaliser avec ces données, sans publier les crochets :

```text
Éditeur : [IDENTITÉ_JURIDIQUE_COMPLÈTE]
Forme juridique : [FORME_JURIDIQUE]
Adresse : [ADRESSE_PROFESSIONNELLE]
Immatriculation : [NUMÉRO_ET_REGISTRE_APPLICABLES]
Contact : [EMAIL_OFFICIEL]
Responsable de publication : [NOM]
Exercice des droits relatifs aux données personnelles : [EMAIL_DROITS_RGPD]
```

Ces coordonnées doivent remplacer la prépublication de
`/legal/mentions-legales`. Les versions approuvées doivent ensuite être
publiées dans `/legal/cgu` et `/legal/confidentialite`, avec les conditions,
finalités, bases légales, durées et prestataires réellement retenus. Le dossier
opérateur seul ne modifie pas ces pages publiques.

## Ce qui bloque encore l’ouverture

1. **Encaissement réel :** le verrou applicatif refuse volontairement Stripe
   live. La configuration de test ne prouve ni la recette distante, ni les
   montants/devise/périodicité, ni la fiscalité. Le passage en production n’est
   pas réalisé par ce lot.
2. **Atomicité des webhooks :** corrigée par le complément du 6 novembre ci-dessous : RPC transactionnel, verrou du profil et arbitrage des événements. Une recette Stripe réelle reste distincte des tests SQL locaux.
3. **Dossier juridique :** identité et coordonnées de l’exploitant, textes
   contractuels approuvés, affichage fiscal, conservation effective et accords
   prestataires ne sont pas établis par les pages provisoires du dépôt.
4. **Effacement global :** l’export et la demande existent ; ils ne valent pas
   exécution complète auprès d’Auth, Storage, des autres prestataires et des
   sauvegardes. Le runbook, ses responsables et les preuves d’exécution doivent
   être validés sans lancer une suppression depuis ce diagnostic.
5. **Emails :** sept rendus et une simulation locale existent. Le transport
   Resend, le domaine/expéditeur vérifié, les déclencheurs, les reprises et le
   suivi de remise ne sont pas activés. Les emails rendus ne prouvent pas une
   livraison et le diagnostic n’ouvre aucune connexion Resend.
6. **Promesses produit :** comptes sociaux déclarés manuellement, rapport
   Studio de divulgation commerciale et PDF documentaire avec SHA-256 sont les
   fonctions internes disponibles. OAuth social, garantie de brand safety,
   signature qualifiée ou horodatage par tiers de confiance ne sont pas livrés.

## Prérequis manquants — sans configuration externe

Les éléments ci-dessous complètent les champs du dossier opérateur déjà listés
plus haut ; ils ne changent aucun paramètre ni statut d’intégration. Les données
opérateur manquantes ne sont pas déductibles du nom MentionCheck ou du code.
Les valeurs réelles doivent être recueillies et validées par l’opérateur avant
toute configuration ou activation.

| Domaine | État connu dans le dépôt | À confirmer par l’opérateur avant intégration | Données opérateur non fournies |
|---|---|---|---|
| OAuth social | Déclaration manuelle disponible ; aucun flux OAuth fournisseur ni gestion de jeton n’est activé. | Réseaux à prendre en charge, compte développeur et validation de chaque application, scopes minimaux, URI de retour, cycle de révocation et information des utilisateurs. | Réseaux choisis, titulaire des comptes développeur, origines et URI de retour approuvées, autorisations effectivement accordées. |
| Emails | Rendus et simulation locale disponibles ; aucun transport fournisseur ni domaine expéditeur n’est configuré. | Fournisseur retenu, propriété et authentification du domaine, expéditeur et réponse, déclencheurs, base d’envoi, désabonnement si applicable, rebonds et suivi des erreurs. | Domaine, adresses d’expédition/réponse, compte fournisseur, événements à notifier et responsable de suivi. |
| Stripe | Checkout/webhook en mode de test préparé ; le mode live est refusé et aucune recette de paiement distante n’est établie. | Produits, devise, montant et périodicité exacts, taxes, parcours de souscription/échec/annulation, remboursement, webhook de test et mentions associées ; conserver les secrets uniquement dans le gestionnaire approprié. | Décision tarifaire et fiscale, compte opérateur, identifiants de prix de test et endpoint de test autorisé. |
| Mentions et conditions | Pages légales provisoires ; identité de l’éditeur, coordonnées et textes finaux non validés. | Identité et coordonnées réelles, responsable de publication, prix et taxes, conditions d’accès/résiliation/rétractation et revue juridique adaptée à l’activité. | Raison sociale ou nom réel, forme juridique, adresse, immatriculation, contacts officiels et version approuvée des textes. |
| Contrats et transferts | Des références de revue sont prévues dans le dossier, sans preuve ici d’approbation des contrats applicables. | Examiner les accords et sous-traitants réellement utilisés, lieux de traitement/sauvegarde, transferts, conservation et clauses requises avant de retenir chaque fournisseur. | Contrats et versions applicables, région retenue, résultats de revue et personne habilitée à les approuver. |

Le dossier privé existant peut recevoir les références de pièces et de revue ;
ne pas y copier de secret ni publier de donnée entre crochets. Tant que les
informations ne sont pas fournies et les revues non terminées, conserver les
intégrations désactivées. Cette checklist n’autorise ni paramétrage externe ni
activation, et ne constitue pas un avis juridique.

## Validation locale sans fournisseurs

```sh
npx vitest run tests/unit/commercial-readiness.test.ts \
  tests/unit/pricing-solo.test.ts tests/unit/email-templates.test.ts \
  tests/unit/email-product-templates.test.ts tests/unit/email-simulation.test.ts \
  tests/unit/billing-events.test.ts tests/unit/billing-config.test.ts \
  tests/unit/billing-simulation.test.ts tests/unit/stripe-solo-checkout.test.ts \
  tests/unit/stripe-webhook.test.ts
npm run typecheck
npx eslint lib/billing lib/email app/tarifs app/api/stripe/webhook/route.ts \
  tests/unit/commercial-readiness.test.ts tests/unit/pricing-solo.test.ts \
  tests/unit/email-templates.test.ts tests/unit/email-simulation.test.ts \
  tests/unit/stripe-webhook.test.ts tests/unit/billing-events.test.ts --max-warnings=0
```

Résultat du lot : **10 suites, 39 tests réussis**, TypeScript et lint ciblé
réussis. Les frontières Stripe et base sont simulées dans les tests du webhook ;
aucune transaction Stripe réelle ni recette de concurrence PostgreSQL distante
n’est revendiquée. Le réseau sortant des tests unitaires est bloqué par le
setup du dépôt. Le build, Playwright et la validation globale du SHA final sont
rapportés séparément par la livraison principale.

### Parcours tarifaire sans paiement

Les tests `pricing-solo` rendent les offres avec Stripe désactivé et vérifient
les prix indicatifs, la démonstration Solo et l’absence de CTA de paiement.
`stripe-solo-checkout` vérifie le refus avant authentification lorsque la
facturation est désactivée, le contrôle d’origine, l’absence du tarif Solo et
le masquage d’une erreur fournisseur simulée. La création de session reste
mockée ; aucun service externe n’est appelé.

```sh
npm test -- tests/unit/pricing-solo.test.ts tests/unit/stripe-solo-checkout.test.ts
```

Résultat local : **8 tests réussis**.

## Complément du 6 novembre — atomicité

La limitation transactionnelle décrite plus haut est corrigée dans la migration `20261105122000_billing_atomic_sync.sql` et le webhook utilise ce RPC service-only. Le verrou du profil sérialise abonnement et droits dans une transaction. Les anciennes souscriptions, dates d'événement périmées et résurrections d'abonnements annulés sont refusées. Les lignes historiques sans date de création fournisseur nécessitent une réconciliation explicite avant remplacement : aucune date n'est inventée. SQL testé exclusivement sur PostgreSQL local ; facturation toujours désactivée.
