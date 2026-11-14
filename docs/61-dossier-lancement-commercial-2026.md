# MentionCheck — dossier de pré-lancement commercial
État : **PROJET — NE PAS PUBLIER / NE PAS ACTIVER STRIPE LIVE**
Date de préparation : 10 novembre 2026. France, régime de franchise en base
de TVA **envisagé**, sous réserve d'éligibilité et de confirmation fiscale.

Ce fichier sert à finaliser les pièces réelles avant publication. Il mentionne
l'identité et les identifiants déclarés par l'exploitant, sans prouver son
immatriculation, et ne constitue ni un contrat approuvé ni un avis juridique.

### Confirmation d'identité du 14 novembre 2026 — déclaration de l'exploitant

- **Identité de l'entrepreneur individuel : Rassoul Ali** (présentée « Ali Rassoul » dans la source publique `lib/branding.ts` et les mentions légales ; il s'agit de la même personne). « Jean Dupont » n'est pas l'exploitant et ne doit être repris dans aucun document.
- **Nom commercial déclaré : Aliaicorp** (source publique alignée : `Aliaicorp`). Statut micro-entreprise / EI déclaré, sans attestation d'immatriculation annexée au dossier.
- **SIREN déclaré par l'exploitant : `899 123 459` ; SIRET corrigé communiqué : `899 123 459 00013`.** Ces identifiants sont repris tels que fournis par l'exploitant, sans vérification administrative sur Internet ni attestation d'immatriculation jointe. Le SIRET antérieurement communiqué (`899 123 459 00017`) est remplacé et ne doit plus être utilisé. Le SIRET figure dans la source des mentions légales de cette PR avec la qualification « déclaré » ; cette déclaration ne prouve pas sa validité administrative et ne suffit pas, à elle seule, à attester les autres conditions légales, fiscales et fonctionnelles de l'activation Stripe Live.
- **Coordonnées professionnelles confirmées le 14 novembre 2026 par l'exploitant :** 100 avenue Gambetta, 47500 Fumel, France ; `contact@aliaicorp.fr`. L'adresse de Paris communiquée antérieurement est remplacée dans la source publique. Le numéro de téléphone déjà déclaré est conservé. Aucune vérification administrative externe n'a été demandée ni effectuée.
- **Fiscalité :** franchise en base déclarée ; tarifs nets communiqués : Solo 9 €/mois, Pro 19 €/mois, Studio 49 €/mois, sans TVA ajoutée au paiement. Mention affichée : « TVA non applicable, art. 293 B du CGI ». Cela ne vaut pas revue fiscale du champ d'application, notamment pour les ventes B2C/B2B hors de France.
- **CGV :** validation finale non encore fournie ; conserver le statut brouillon. Ne pas activer Stripe Live, ne créer ni encaissement ni abonnement sur la seule déclaration d'identité.

Cette note est un relevé interne des informations déclarées, pas une attestation d'identité, de numéro d'immatriculation ou de conformité juridique. Elle ne remplace pas le dossier opérateur privé.

## Décision opérateur — lancement sans convention de médiation (14 novembre 2026)

L'exploitant demande explicitement de **poursuivre sans adhésion à un médiateur**. Cette instruction permet les travaux préparatoires, les tests hors production et l'étude d'une **offre exclusivement destinée aux acheteurs professionnels**, mais **n'efface pas l'obligation de médiation des ventes aux consommateurs** (Code de la consommation, article L612-1). Il est interdit d'attester `STRIPE_LIVE_TERMS_REVIEW=approved` pour des ventes B2C, ou de supprimer silencieusement les droits à la médiation des CGV.

**Option commerciale conditionnelle : lancement limité aux clients professionnels réellement éligibles (B2B)** :
- Avant le paiement, recueillir l'identification vérifiable de l'entreprise cliente (raison sociale, identifiant professionnel selon pays, adresse de facturation) et documenter la finalité **professionnelle** de l'achat. Ne pas accepter une simple case « je suis professionnel » comme preuve suffisante ; contrôler spécialement les petites entreprises lorsque le contrat est hors de leur activité principale et peut relever de protections du Code de la consommation.
- Configurer une restriction **côté serveur** de l'accès Checkout Live aux comptes dont la qualité professionnelle et le lien de la prestation à leur activité ont été vérifiés. Un affichage « réservé aux professionnels » dans la page Tarifs n'est pas un contrôle d'accès. Les abonnements Solo/Pro/Studio ne doivent pas être proposés indistinctement à des consommateurs.
- Prévoir des conditions et factures destinées aux professionnels, vérifier territorialité/TVA, gestion des justificatifs, conséquences des droits particuliers des très petites entreprises, ainsi que confirmation durable/résiliation ; soumettre cette option à une revue juridique/fiscale spécifique et à une recette Stripe **Sandbox**.
- Conserver **l'intégralité des flags Live fermés** et les CGV en prépublication tant que le contrôle d'éligibilité côté serveur, la fiscalité, la livraison réelle des services IA et le parcours paiement/webhook n'ont pas été attestés. Aucune donnée client ou abonnement réel ne doit être modifié pour déclarer cette option ouverte.

L'alternative B2B **n'est ni construite ni commercialement activée** à la date de cette note ; elle permet de ne pas faire dépendre sa préparation du contrat CM2C. Le segment B2C demeure **NO GO** sans dispositif de médiation effectivement accessible.

**Sources officielles :**
- [Article L612-1 — médiation pour les consommateurs](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032224805)
- [FAQ officielle : litiges entre professionnels exclus de la médiation de la consommation](https://www.economie.gouv.fr/mediation-conso/foire-aux-questions)
- [Service-Public — médiation et certaines petites entreprises](https://entreprendre.service-public.gouv.fr/vosdroits/F33338)
- [Article liminaire — distinctions consommateur, non-professionnel et professionnel](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000049464063)

## Médiation de la consommation — option préparée (14 novembre 2026)

**Option à examiner : CM2C (Centre de Médiation de la Consommation des Conciliateurs de justice)**, présent dans la [liste officielle CECMC](https://www.economie.gouv.fr/mediation-conso/vous-etes-un-professionnel/choisir-un-mediateur-de-la-consommation/mediateurs-references). Son [barème public](https://www.cm2c.net/tarifs.php) indique, au contrôle du 14 novembre 2026, **48 € pour trois ans** jusqu'à 10 salariés, payables en une fois, et **36 € pour une médiation à distance**. [Inscription professionnelle](https://www.cm2c.net/inscription-professionnel.php).

**À ne pas considérer comme convention déjà conclue :** vérifier d'abord auprès de CM2C qu'il accepte explicitement les litiges de **prestations de services numériques/SaaS d'abonnement B2C**, et confirmer le coût total, la durée, les frais au dossier et les modalités de convention. L'exploitant doit accepter le contrat et tout paiement. La DGCCRF rappelle qu'un médiateur doit être effectivement choisi et conventionné avant publication de ses coordonnées sur le site et les CGV : [guide officiel](https://www.economie.gouv.fr/mediation-conso/vous-etes-un-professionnel/choisir-un-mediateur-de-la-consommation). Après obtention de la convention, renseigner **le nom exact, l'adresse et le site du médiateur** dans les CGV et les mentions requises. **Ne pas inscrire « médiateur CM2C désigné » avant cela.**

### Lot agent commercial — sans encaissement

Mission unique `stripe-sandbox-consumer-e2e` inscrite dans `docs/work-registry.json` pour préparer la recette Stripe **Sandbox** et les preuves des parcours B2C (confirmation sur support durable, portail résiliation, rétractation, remboursements, échecs de paiement, droits payants et retour au plan gratuit). Réutiliser les scripts/tests actuels et le code de facturation ; **aucune migration Solo**, aucune souscription Live, aucun basculement de drapeaux Cloudflare ni appel OpenAI facturable. Les validations fiscales, la convention de médiation et les dépenses restent hors de portée de l'agent, avec décision opérateur séparée.

## Actualisation CGV et fiscalité — 14 novembre 2026

**Travail réalisé, sans recherche externe sur l'immatriculation :**
- Page `/legal/cgu` complétée : reconduction mensuelle automatique, information précontractuelle, gestion de la résiliation depuis Paramètres/Facturation avec recours au support, rétractation de principe à 14 jours pour les consommateurs, remboursement suivant les conditions légales, absence de renonciation automatique, garantie légale de conformité des services numériques et confirmation contractuelle sur support durable.
- Page `/tarifs` et CTA Stripe alignés : prix mensuels nets déclarés 9 € / 19 € / 49 €, renouvellement, résiliation et lien vers le formulaire de rétractation, sans laisser croire à une ouverture commerciale effective.
- Identité et coordonnées déclarées : Rassoul Ali / Ali Rassoul, Aliaicorp, 100 avenue Gambetta, 47500 Fumel, `contact@aliaicorp.fr`, SIREN `899 123 459`, SIRET `899 123 459 00013` (aucune certification administrative revendiquée).
- Fiscalité : franchise en base de TVA déclarée et tarifs nets pour les opérations où elle s'applique ; **aucune attestation d'éligibilité fiscale ni des ventes transfrontalières**. La configuration des prix Stripe Live est `tax_behavior=inclusive` ; ce réglage, à lui seul, ne prouve pas le traitement fiscal ni la conformité des factures.

**Préflight Stripe Live en lecture seule du 14 novembre 2026 (sans écriture fournisseur) :**
- Compte Stripe français `business_type=individual`, encaissements/virements autorisés, aucune exigence `currently_due` retournée.
- **Adresse cohérente selon la dernière déclaration de l'exploitant :** Stripe Account (adresse de l'individu et de l'entreprise) et Stripe Tax `head_office` présentent **100 avenue Gambetta, 47500 Fumel**, désormais l'adresse retenue dans les mentions légales. Il ne subsiste donc plus d'écart d'adresse entre ces sources au dernier contrôle, sans que cela atteste une immatriculation ou une vérification fiscale administrative.
- Stripe Tax : `status=active`, `registrations=[]`, `defaults.tax_behavior=null` ; les trois tarifs Live restent `tax_behavior=inclusive`. **Le fait que Stripe Tax soit disponible n'atteste ni TVA facturée, ni conformité de franchise**, et le Checkout de l'app ne demande pas actuellement de calcul automatique de TVA.
- Profil Stripe : site vitrine de l'entreprise encore renseigné sur `mentioncheck.toto-rina47501.workers.dev` au lieu de `https://mentioncheck.app` ; adresse email de support du profil absente. À rapprocher des coordonnées légales publiées avant la commercialisation.
- Portail Stripe Live : configuration active et par défaut, `subscription_cancel.enabled=true`, `mode=at_period_end`, `proration_behavior=none`, historique des factures activé ; **le parcours de résiliation depuis MentionCheck et la confirmation au client restent à tester en réel**.

**Actions contractuelles restant indispensables avant les premières ventes B2C :**
1. **Médiation de la consommation** : choisir un médiateur compétent, conclure la convention correspondante et renseigner son **nom, adresse, site Internet** dans les CGV. Aucun organisme n'est inventé et aucune convention n'est attestée.
2. **Revue fiscale / territorialité** : confirmer le régime applicable à la vente en France et arrêter le traitement des clients situés hors de France (notamment services numériques B2C dans l'UE, clients B2B, éventuelle TVA à destination), le mode facturation Stripe et les mentions des factures ; ne pas supposer qu'un tarif `inclusive` résout ces obligations.
3. **Parcours et preuves** : vérifier en conditions fournisseur le lien de résiliation en ligne, l'accusé de réception, la confirmation contractuelle durable et le remboursement/retrait avant de lever `STRIPE_LIVE_TERMS_REVIEW` et `STRIPE_LIVE_TAX_REVIEW`.

Les CGV restent en **prépublication / noindex**, sans affirmation de validation professionnelle ou conventionnelle. Ces travaux ne doivent pas activer Stripe Live ni modifier les abonnements et comptes historiques.

## 1. Informations éditeur à fournir (jamais inventer)

| Champ | À fournir et vérifier |
| --- | --- |
| Identité | Rassoul Ali (présenté « Ali Rassoul »), entrepreneur individuel déclaré ; non vérifié par registre externe |
| Statut | Micro-entreprise / entrepreneur individuel, régime déclaré par l'exploitant, éligibilité administrative et fiscale non attestée |
| SIREN / SIRET | 899 123 459 / 899 123 459 00013, identifiants communiqués par l'exploitant, sans validation administrative externe |
| Adresse | 100 avenue Gambetta, 47500 Fumel, France — déclarée comme siège professionnel à publier |
| Directeur de publication | Ali Rassoul, selon déclaration de l'exploitant |
| Courriel et SAV | contact@aliaicorp.fr, accessibilité et réception des messages à tester |
| Contact RGPD | contact@aliaicorp.fr, destinataire de la politique existante |
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

**Réclamation / remboursement** : contact@aliaicorp.fr ; procédure de
réclamation et délai de réponse à définir. Pour les consommateurs,
fournir les coordonnées du médiateur de la consommation désigné,
une fois le contrat correspondant conclu.

**Disponibilité** : aucun niveau de service contractuel chiffré n'est annoncé. Ne pas promettre de
service IA continu avant réactivation et tests de débit/quotas.
Toute fermeture, suspension ou modification de l'offre doit être
prévue dans les CGV finales, selon les droits contractuels applicables.

## 3. Texte de formulaire de rétractation — PROJET

À l'attention de : Ali Rassoul (Aliaicorp), contact@aliaicorp.fr

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
La facture doit porter la mention de non-application : au **14 novembre
2026**, l'administration fiscale indique notamment **« TVA non applicable,
art. 293 B du CGI »** pour les entreprises bénéficiant effectivement de
la franchise en base. La recodification correspondante de la TVA dans
le CIBS, initialement annoncée pour le 1er septembre 2026, a été reportée
au **1er janvier 2027** par l'article 17 de l'ordonnance n° 2026-671 du
27 juillet 2026 (modifiant l'article 49 de l'ordonnance n° 2025-1247).
Ne pas présenter l'article 293 B comme simplement « toléré depuis
septembre 2026 ». La prochaine date d'effet doit être revue lors de la
préparation des factures postérieures à 2026. Le code ne certifie ni
l'éligibilité de l'exploitant à la franchise ni son application aux ventes
hors France. Un libellé « prix TTC » dans un catalogue technique Stripe
(`tax_behavior=inclusive`) ne prouve en aucun cas qu'une TVA est
effectivement due ou collectée.

Sources officielles consultées le 14/11/2026 :
- [Ordonnance n° 2026-671, article 17, report de la date](https://www.legifrance.gouv.fr/eli/ordonnance/2026/7/27/ECOE2610185R/jo/article_17)
- [Impôts — obligations TVA du micro-entrepreneur](https://www.impots.gouv.fr/professionnel/questions/en-tant-que-micro-entrepreneur-puis-je-etre-redevable-de-la-tva)

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

## Décisions retenues le 10 novembre — annexe versionnée

L'exploitant a choisi **l'EI sous régime micro-entreprise** (non encore immatriculée), **Supabase Auth Free** avec compensations et acceptation du risque résiduel, **30 jours Solo promotionnel pour deux comptes historiques**, **25 USD mensuels de budget API OpenAI** sous réserve d'un plafond strict vérifié, et **l'ouverture publique seulement après certification complète**. Les prérequis et scripts de promotion sont dans [le plan de décision](63-launch-decisions-20261110.md). Aucune validation fournisseur externe ni dépense n'est réputée accomplie.

## 7. Préparation Cloudflare — tarifs Stripe Live, encaissements toujours fermés

Le `wrangler.jsonc` de production référence les trois identifiants Stripe Live (Solo 9 € : `price_1UaKLwCdRRAa9LkpiXUiv0wc`, Pro 19 € : `price_1UaKLyCdRRAa9Lkp5daPFLZK`, Studio 49 € : `price_1UaKM0CdRRAa9Lkptx9oZCS8`). Ils ne sont pas des secrets. Le worker reste strictement verrouillé : `BILLING_ENABLED=false`, `STRIPE_WEBHOOK_ENABLED=false`, `STRIPE_LIVE_APPROVED=false`. Aucun flux n'autorise les paiements et aucune promotion n'est lancée. Staging/preview conservent leur configuration test distincte. La fusion/déploiement du `wrangler.jsonc` ne prouve pas à elle seule que l'environnement Cloudflare effectif a reçu ces variables : consulter les versions Worker/builds et vérifier la configuration runtime sans exposer les secrets.

Les secrets `STRIPE_SECRET_KEY` (clé API Live autorisée au minimum nécessaire) et `STRIPE_WEBHOOK_SECRET` (signature de la destination Live) doivent être installés dans le coffre **Cloudflare Worker production seulement**, jamais dans GitHub, le dépôt, les logs ou le Worker staging. Tant que ces secrets et la recette de sécurité/légale/fiscale ne sont pas certifiés, ne pas passer les flags d'activation à `true`.
