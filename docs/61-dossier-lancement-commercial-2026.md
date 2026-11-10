# MentionCheck — dossier de pré-lancement commercial
État : **PROJET — NE PAS PUBLIER / NE PAS ACTIVER STRIPE LIVE**
Date de préparation : 10 novembre 2026. France, régime de franchise en base
de TVA **envisagé**, sous réserve d'éligibilité et de confirmation fiscale.

Ce fichier sert à finaliser les pièces réelles avant publication. Il ne
prouve aucune immatriculation, n'identifie pas l'exploitant et ne constitue
ni un contrat approuvé ni un avis juridique.

## 1. Informations éditeur à fournir (jamais inventer)

| Champ | À fournir et vérifier |
| --- | --- |
| Identité | [NOM_ET_PRÉNOM_ENTREPRENEUR_INDIVIDUEL] ou raison sociale réelle |
| Statut | [FORME_JURIDIQUE_VALIDÉE] — micro-entreprise / EI uniquement si immatriculée |
| SIREN / SIRET | [IDENTIFIANT_OFFICIEL] et immatriculation RNE/RCS selon activité |
| Adresse | [ADRESSE_PROFESSIONNELLE_PUBLIABLE] |
| Directeur de publication | [NOM] |
| Courriel et SAV | [CONTACT_EMAIL_SUIVI] |
| Contact RGPD | [EMAIL_RGPD_SUIVI] |
| Hébergeur | Cloudflare, dénomination, adresse et téléphone **à vérifier et publier** |
| Sous-traitants | Supabase, Cloudflare, Stripe, OpenAI si IA activée ; DPA et géographies à vérifier |

Ne pas remplacer les pages publiques actuelles par ce texte avant
la vérification des champs et la revue contractuelle.

## 2. Projet de clauses CGV / abonnement

**Service** : MentionCheck fournit une aide à la relecture de publications
commerciales. Les résultats et scores ne garantissent pas la conformité et
ne constituent pas une consultation juridique. Fonctionnalités et quotas
sont ceux publiés sur la fiche de chaque forfait, dans les limites
réelles du produit. Les fonctions IA désactivées ne sont pas proposées
comme disponibles.

**Offres et prix** (proposition, à valider fiscalement) :
Solo 9 €, Pro 19 €, Studio 49 € **par mois**, renouvellement mensuel.
Gratuit à 0 € sans carte. Aucun dépassement automatique facturé ;
un quota atteint doit être bloqué. Les montants affichés sont les prix
finaux avant validation de l'assujettissement TVA et du pays du client.
Vérifier explicitement l'applicabilité de la franchise en base, la vente
de services numériques B2C dans l'UE et les situations B2B internationales.

**Souscription et paiement** : activation de l'abonnement après vérification
de l'état Stripe par webhook signé. Carte et authentification forte
éventuelle sur l'interface hébergée Stripe ; jamais de numéro de carte
collecté dans MentionCheck. Le montant, l'échéance et la reconduction
doivent être visibles avant la validation finale et dans la confirmation
durable communiquée au client.

**Renouvellement et résiliation** : abonnement reconduit mensuellement,
sauf résiliation. Portail client accessible depuis Paramètres ;
résiliation à échéance via Stripe Billing Portal, selon les conditions
affichées et sous réserve de la continuité du compte. Une voie de
contact alternative doit être renseignée pour les cas de panne ou
de perte d'accès. Vérifier les obligations de résiliation électronique
et de preuve de confirmation pour les clients consommateurs.

**Rétractation** : pour un consommateur contractant à distance, prévoir
en principe 14 jours à compter de la conclusion du service, les
conditions d'exception et de début d'exécution relevant des règles
applicables au service numérique. Ne **pas** annoncer une renonciation
automatique. Fournir un formulaire de rétractation et une voie de dépôt
claire ; déterminer si une rétractation totale/partielle est due selon
l'exécution commencée et l'accord du client. Vérification juridique requise.

**Réclamation / remboursement** : [EMAIL_SUPPORT] ; procédure de
réclamation et délai de réponse à définir. Pour les consommateurs,
fournir les coordonnées du médiateur de la consommation désigné,
une fois le contrat correspondant conclu.

**Disponibilité** : [SLA_ET_LIMITES_VALIDÉS]. Ne pas promettre de
service IA continu avant réactivation et tests de débit/quotas.
Toute fermeture, suspension ou modification de l'offre doit être
prévue dans les CGV finales, selon les droits contractuels applicables.

## 3. Texte de formulaire de rétractation — PROJET

À l'attention de : [IDENTITÉ_ET_EMAIL_DE_L'ÉDITEUR]

Je vous notifie ma rétractation du contrat d'abonnement MentionCheck
souscrit le [DATE] ; référence : [NUMÉRO_DE_COMMANDE].

Nom du client : [NOM]. Adresse ou courriel de contact : [COORDONNÉES].
Date de la notification : [DATE].

Le canal de réception et les modalités de preuve / remboursement
sont à renseigner et tester avant la première vente B2C.

## 4. Politique RGPD — champs factuels à finaliser

| Traitement | À documenter |
| --- | --- |
| Authentification | Identifiant, email, cookies de session ; base juridique, durée et sécurité |
| Facturation | Identifiant Stripe, abonnement, factures ; obligations fiscales et durée |
| Analyses | Textes, scores, historiques ; finalités, durées par catégorie |
| Médias | Fichiers privés, stockage Supabase, suppression physique encore à certifier |
| Mia et RAG | Conversations, index juridique, embeddings ; activer seulement si autorisé |
| Prestataires | Cloudflare, Supabase, Stripe, OpenAI si IA active ; DPA / transferts |
| Droits | Adresse de contact, accès, rectification, portabilité selon cas, opposition et effacement |
| Cookies | Séparer strictement session nécessaire et éventuels traceurs soumis au consentement |

Les délais de conservation et les bases légales ne doivent pas être
inventés : élaborer la matrice réelle avec le registre de traitements,
l'inventaire Storage et les contrats des prestataires. La suppression
totale des fichiers chez tous les prestataires n'est pas encore prouvée.

## 5. Fiscalité française — point de contrôle important

Sous une **franchise en base de TVA réellement applicable**, les
prestations françaises concernées ne donnent pas lieu à perception de TVA.
La facture doit porter la mention de non-application. Depuis
le **1er septembre 2026**, la référence privilégiée est :
**« TVA non applicable, art. L. 223 et s. du CIBS »**.
La référence historique à l'article 293 B du CGI reste tolérée jusqu'au
**31 décembre 2027**. Un libellé « prix TTC » dans un catalogue
technique Stripe (`tax_behavior=inclusive`) ne prouve en aucun cas
qu'une TVA est effectivement due ou collectée.

Ne pas activer Stripe Tax automatiquement ni créer de taxe ou de
registration sans confirmer le pays de l'éditeur et les ventes
transfrontalières. Vérifier les factures Stripe, leur numérotation et
leurs mentions obligatoires ; ne pas supposer que le portail Stripe
ajoute seul toutes les mentions françaises requises.

## 6. Checklist de décision « go / no-go »

- [ ] Déclaration de l'activité au guichet unique, justificatif et SIREN/SIRET confirmé.
- [ ] Stripe compte **live** au nom du même exploitant, identité/KYC vérifiée.
- [ ] CGV, mentions légales, contact, médiation, rétractation, confidentialité approuvés et publiés.
- [ ] Fiscalité franchise TVA / CIBS, factures de test, export et ventes UE vérifiés.
- [ ] AI réactivée seulement avec budget explicite, tests de capacité et modalités annoncées.
- [ ] Paiement par **carte test** : succès, échec, SCA/3DS, facture, webhook signé, rétrogradation et résiliation.
- [ ] Portail client accessible, résiliation à échéance et parcours de rétractation indépendants testés.
- [ ] DPA, durées et suppression de données prouvées ; email de confirmation transactionnelle fonctionnel.
- [ ] Secrets, 3 prix live, webhook live et config du portail **distincts du Sandbox**.
- [ ] PR revue, migration production exécutée et vérifiée, CI verte, plan de rollback documenté.
- [ ] Activation `BILLING_ENABLED=true` uniquement après feu vert final ; contrôle des transactions et du statut.

**État au 10 novembre 2026** : CI / staging / Checkout sans carte et
webhooks signés OK. Aucun encaissement réel. Pas d'immatriculation
fournie ; pages légales en brouillon ; services IA actuellement suspendus.

## Sources officielles consultées

- Création EI : https://entreprendre.service-public.fr/vosdroits/F36763
- Mentions site internet : https://entreprendre.service-public.gouv.fr/vosdroits/F37351
- Fiscalité micro et référence CIBS : https://entreprendre.service-public.gouv.fr/vosdroits/F36244
- TVA franchise : https://entreprendre.service-public.gouv.fr/vosdroits/F21746
- Informations précontractuelles : https://www.service-public.gouv.fr/particuliers/vosdroits/F10483
- Rétractation : https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/delais-de-reflexion-ou-de-retractation-comment-sappliquent-ils
- CNIL : https://www.cnil.fr/fr/passer-laction/rgpd-les-premieres-etapes
- Stripe : https://docs.stripe.com/get-started/account/set-up

## 7. Préflight production en lecture seule — 10 novembre

**Constat distant vérifié :** Supabase production `zcztvberuihphqklhjsr`
possède 2 profils et 0 abonnement. La fonction
`public.consume_usage_quota(uuid,text)` n'a pas encore la branche
Gratuit à 3 analyses. Le schéma staging `ukvgnkxgzyhswgpnvyzz`
a la migration corrective `free_vs_paid_solo_quotas`.
Ne pas annoncer `free` comme actif en production sur cette seule base.

**Séquence sûre, aucune étape à inverser** :

1. Vérifier l'identité légale, les pages publiées, le consentement et les
   conditions d'utilisation ; ne pas ouvrir de ventes sans l'ensemble.
2. Établir une sauvegarde et un plan de rollback **testé** de Supabase
   production ; vérifier tous les usages des fonctions de quota.
3. Inspecter les deux profils préexistants (usage et statut, sans révéler
   de données personnelles). Vérifier qu'aucun plan professionnel n'a
   été accordé manuellement : la migration réduira les plafonds sans
   abonnement actif ; avertir/traiter les comptes concernés si nécessaire.
4. Faire approuver et fusionner le code correspondant à la migration ;
   déployer le code et la migration de façon coordonnée, hors des heures
   critiques, puis contrôler les quotas et la session authentifiée.
5. Vérifier toutes les routes publiques, la politique de logs, les
   signatures webhook, la sécurité RLS et le rollback applicatif.
   Garder `BILLING_ENABLED=false` et les flags IA en pause jusqu'à
   la levée explicite des bloqueurs légaux et contractuels.
6. Déclencher et suivre la CI du SHA déployé sur `main` ; ne pas
   confondre le succès de la PR ou de staging avec une certification
   production. Conserver la PR en brouillon tant que cette revue n'est
   pas faite.

Requêtes *lecture seule* avant la décision, à exécuter par un opérateur
habilité : `select count(*) from public.users;`,
`select count(*) from public.subscriptions;` et
`select position('else 3 end' in pg_get_functiondef(
'public.consume_usage_quota(uuid,text)'::regprocedure)) > 0 as free_tier_present;`.

Le contrôle gratuit `execution=rules_only` reste le parcours le plus
économe : il ne doit jamais appeler OpenAI ni consommer un quota d'analyse
IA. Toute sélection explicite du mode IA alors que le fournisseur est en
pause doit être refusée **avant** la réservation du quota, avec une
instruction claire pour basculer vers le mode sans IA.
