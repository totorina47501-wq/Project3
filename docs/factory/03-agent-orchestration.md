# SaaS Factory — orchestration des agents depuis GitHub Mobile

## Portée et état actuel

Ce guide décrit un processus opérable, pas une nouvelle automatisation. Le dépôt reste
MentionCheck ; la future usine SaaS reste indépendante. Le mécanisme d'auto-fusion pilote
actuellement présent est `.github/workflows/factory-safe-automerge.yml`, limité à la
fusion sûre de documentation. Ne pas le modifier pour cette mission, ni déduire qu'une
issue assignée à Copilot ou une PR créée automatiquement est déjà autorisée.

Le pilote de fusion attend une exécution réussie de `MentionCheck CI`, une PR ouverte,
non brouillon, de la même base, ciblant `main`, au SHA exact du run, le label explicite
`factory:auto-merge-safe`, des chemins Markdown admis, et le succès de `quality` et
`Image du runner média (sans fournisseur)`. Il relit le SHA avant la fusion. Il ne lance
pas le code de la PR et ne déploie pas. Les protections de branche et revues requises
restent applicables. Le label n'est pas présent dans la liste actuelle des labels du
dépôt : le réserver à un opt-in humain explicite, et ne pas le créer ni le poser
automatiquement dans le cadre de ce document.

## Parcours mobile, avec points de contrôle humains

1. **Demande.** Depuis GitHub Mobile, ouvrir une issue sur le dépôt concerné. Une demande
   doit décrire le résultat attendu, les critères d'acceptation vérifiables, les chemins
   autorisés/interdits, les tests attendus, les dépendances éventuelles et le niveau de
   risque. Ne pas mettre de secret, donnée de production ou donnée personnelle dans le
   titre, le corps, les pièces jointes ou les commentaires.
2. **Triage avant assignation.** Un mainteneur recherche les issues/PR existantes,
   confirme le dépôt et l'absence de doublon, découpe les tâches trop larges, applique
   les labels adaptés et bloque les changements à haut risque pour une revue humaine.
   Une issue ne vaut pas autorisation d'élargir son périmètre.
3. **Assignation.** Si l'interface et les réglages du dépôt autorisent effectivement
   l'assignation à Copilot, l'opérateur l'effectue depuis l'issue. Vérifier la capacité
   et les permissions du compte au lieu de supposer que Copilot est un utilisateur
   assignable. Si l'assignation est indisponible ou nécessite une approbation, laisser
   l'issue en attente et demander l'intervention d'un mainteneur ; ne pas contourner le
   réglage avec un token ou un autre compte.
4. **Branche et PR.** Le travail agent utilise une branche isolée `copilot/<sujet>` et
   une PR dédiée vers `main`, limitée à cette issue. La PR référence l'issue et résume
   fichiers, risques et validations. Aucun chevauchement avec un autre agent ou une PR
   en cours : synchroniser ou attendre plutôt que modifier les mêmes fichiers.
   Maintenir la PR en brouillon jusqu'à ce que le périmètre et les résultats initiaux
   soient relus. Ne pas mettre le label d'auto-fusion avant la revue humaine.
5. **CI et décision.** Attendre les checks requis pour le SHA courant. Une CI en
   `action_required` n'est **pas verte** : elle indique qu'une approbation ou action est
   requise. Un mainteneur examine la provenance et la demande d'approbation dans
   GitHub, puis approuve ou refuse selon la politique du dépôt. Après approbation,
   relancer/attendre les checks et vérifier qu'ils sont `success` sur le dernier SHA ;
   ne pas assimiler l'attente, un check ignoré, annulé, en échec ou un ancien succès à
   une validation.
6. **Correction bornée.** En cas d'échec explicite, demander à l'agent une correction
   limitée aux erreurs de CI et au périmètre initial, sur la même branche et PR. Politique
   opératoire proposée : au plus deux tours de correction après la première livraison.
   Chaque tour doit traiter les erreurs observées et relancer les contrôles sur le
   nouveau SHA. À la limite, en cas d'échec répété, de nouveau défaut ou d'élargissement,
   arrêter l'agent et transférer à un humain ; ne pas créer de PR/issues en boucle.
7. **Fusion sûre.** Un mainteneur vérifie le diff complet, l'issue, les revues, les
   protections et le statut des checks. L'auto-fusion du pilote est réservée aux PR
   documentaires explicitement éligibles et opt-in ; les autres PR sont fusionnées
   manuellement après validation. La fusion dans `main` n'autorise ni ne prouve un
   déploiement, une migration, une activation fournisseur ou une recette de production.

## Matrice des responsabilités et permissions

| Acteur | Autorité minimale pour le parcours | Limites et contrôle |
| --- | --- | --- |
| Demandeur mobile | Ouvrir/commenter une issue ; proposer le périmètre et accepter le résultat métier | Ne pas s'auto-attribuer des droits de fusion, d'administration ou d'accès aux secrets |
| Agent Copilot | Accès au dépôt et à l'issue nécessaires pour proposer un diff et une PR | Pas d'approbation de ses propres changements, de fusion, de secrets, de production ou d'élargissement implicite ; pas de modification des garde-fous pour débloquer sa PR |
| CI de confiance | Permissions de lecture pour vérifier la PR et les checks | Le workflow privilégié existant utilise `contents: write` et `pull-requests: write` pour sa fusion ; conserver strictement son usage et son éligibilité, ne pas réutiliser ce token pour exécuter le code de PR |
| Relecteur / mainteneur | Revue, traitement des approbations requises, décision sur les labels et fusion selon protections | Indépendant de l'auteur ; vérifier le SHA, les chemins, les contrôles et les permissions avant tout opt-in |
| Administrateur du dépôt | Régler l'accès Copilot, Actions, quotas et protections ; arrêter l'automatisation en urgence | Changements de réglages uniquement par le propriétaire/administrateur autorisé, hors de cette mission documentaire |

Conserver les protections de branche, les revues exigées et le moindre privilège.
Ne jamais donner à l'agent ou à un workflow déclenché par du code non fiable un secret
de déploiement, une clé fournisseur ou un droit de modifier ses propres protections.
Ne pas élargir les permissions du workflow pour rendre une assignation ou fusion possible.

## Labels et règles de blocage

Labels généraux déjà disponibles comprennent `documentation`, `enhancement`, `bug`,
`question` et `help wanted`. Choisir ceux qui décrivent la nature de la demande. Les
étiquettes de pilotage ci-dessous sont une convention proposée, pas des labels dont la
présence est établie :

| Label proposé | Usage |
| --- | --- |
| `agent:ready` | Issue triée, critères et chemins bornés ; permet une assignation manuelle si disponible |
| `agent:blocked` | Attente de clarification, permission, approbation ou contrôle humain |
| `agent:needs-review` | PR créée ou correction terminée, revue humaine requise |
| `factory:auto-merge-safe` | Opt-in explicite d'un mainteneur de confiance après revue, uniquement si toutes les conditions du workflow existant sont satisfaites |

Ne pas poser `agent:ready` ni `factory:auto-merge-safe` en masse ou automatiquement.
Le dernier label est un pouvoir de fusion, pas un simple marqueur de statut.

**Bloquer l'assignation ou la fusion** si l'issue est ambiguë ou dupliquée, si les
critères/path allowlist manquent, si une tâche touche production, secrets, données,
authentification/autorisation, RLS, migrations, paiements, déploiement, code métier
sensible ou workflow privilégié, si la branche/PR n'est pas isolée, ou si un conflit
de travail existe. Bloquer également en cas de CI `action_required`, rouge, annulée,
ignorée ou obsolète, de SHA déplacé, de revue obligatoire absente, d'origine
inattendue, de permissions inconnues, de quota atteint ou de correction au-delà de la
limite. Les tâches exclues reviennent à un humain ; ne pas les rendre éligibles en
changeant les critères ou les protections.

## Quotas, alertes et protections anti-boucle

- **Copilot et Actions :** mesurer l'usage et les coûts dans les vues de facturation
  GitHub autorisées. Les budgets et quotas dépendent du forfait et de l'organisation ;
  ne pas supposer de montant fixe. Avant un pilote, le propriétaire fixe les limites,
  seuils d'alerte et responsables ; interrompre les nouvelles assignations à
  l'approche du plafond ou à la réception d'une alerte.
- **Pas de récurrence événementielle :** une PR ou un échec CI ne crée pas une nouvelle
  issue et ne réassigne pas Copilot automatiquement. Une correction est une réponse
  explicite à un échec précis sur la même PR ; les deux tours proposés sont un plafond
  opérationnel, pas une fonction codée par le workflow actuel.
- **Pas de répétition sans changement :** avant une relance, vérifier qu'un nouveau
  commit a corrigé une cause identifiée. Une action requise appelle une décision
  humaine, pas un retry automatique. Arrêter si les checks restent identiques ou
  échouent de nouveau.
- **Déduplication et concurrence :** rechercher issue et PR par lien, branche et sujet
  avant toute création ; une issue active correspond à une branche et une PR dédiées.
  Ne pas lancer deux agents sur les mêmes fichiers.
- **Alertes minimales :** signaler à un mainteneur les demandes d'approbation,
  changements de SHA après revue, checks en échec, refus d'assignation, seuil de coût
  atteint, tentative hors périmètre et absence de progrès. Utiliser les notifications
  GitHub existantes ; ne pas envoyer de journaux sensibles ni ajouter de canal ou
  d'intégration sans autorisation.

## Arrêt d'urgence, suivi et retour arrière

**Arrêt immédiat :** le mainteneur retire le label `factory:auto-merge-safe`, ferme ou
met en brouillon les PR concernées, annule les runs en cours si possible, suspend les
nouvelles assignations et alerte le propriétaire. L'administrateur peut désactiver le
workflow ou révoquer les accès selon la procédure du dépôt. Vérifier ensuite qu'aucun
run ne reste actif et que les branches/PR concernées sont identifiées. Ce document
n'autorise aucune modification des réglages GitHub ou du workflow.

**Suivi par issue/PR :** consigner les références GitHub, branche, SHA livré et vérifié,
résultat des checks, approbations, nombre de corrections, durée issue→PR→décision,
usage d'Actions/Copilot et résultat de fusion. Suivre les échecs et `action_required`
séparément des succès ; ne jamais publier de contenu sensible dans ce relevé.

**Rollback :** pour une fusion documentaire fautive, suspendre d'abord tout opt-in
ultérieur, puis ouvrir une PR de revert ciblée, la faire relire et valider sa CI avant
fusion. Pour toute régression de code ou de service, appliquer la procédure de
rollback propre au composant, sous contrôle humain ; la fusion documentaire ne doit
pas déclencher de déploiement. Garder la référence au commit de fusion et au revert
pour l'audit. Ne jamais annuler directement une migration, modifier des données de
production ou lancer une purge dans le cadre de ce processus.
