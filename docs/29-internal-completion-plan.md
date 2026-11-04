# Développements internes — plan d’exécution

Base initiale : main `83cd61b`, puis intégration des dix commits distants
jusqu’à `14038832cbcafde62c946be7037be4998df13589`. Prolonger les modules existants, sans nouvelle branche,
sans fournisseur activé et sans modification destructive distante. Les choix
d’implémentation sont délégués par l’utilisateur ; aucune validation de design
supplémentaire n’est requise. Livraison en un commit sur main après vérification.

## Architecture retenue

File PostgreSQL avec jobs propriétaires, sources privées confirmées et empreintes
serveur. Un claim atomique réserve un bail à jeton ; les callbacks périmés ne
peuvent plus modifier le job. L’exécuteur local réutilise Sharp/FFmpeg, sans
télécharger un média distant. Le résultat archive le contrôle déterministe de
la légende avec les preuves techniques, sans prétendre analyser visuellement
la vidéo ou transcrire son audio. API/UI de préparation désactivées par défaut
tant que migration et hôte d’exécution ne sont pas validés.

Les autres domaines sont indépendants : RAG existant avec fournisseur simulé et repli lexical,
lots d’apprentissage révocables, effacement exécutable uniquement sur une base
PGlite en mémoire, facturation/emails simulés et E2E Studio sur SQL réel local.

## Tâches et preuves attendues

- [x] File média : migration additive, RLS, accès worker limité, idempotence,
  propriété des sources, baux et reprise/annulation testés sur PostgreSQL local.
- [x] Routes et bibliothèque : validation bornée, origine/session, statut et
  résultat honnêtes, échecs rejouables, archivage lié au contrôle.
- [x] Runner : `claim/complete/fail/isCancelled` injectés ; vrai traitement
  synthétique vidéo/carrousel, hashes, aucun réseau et aucun secret transmis.
- [x] RAG : validation 1536 dimensions, pertinence et sources officielles,
  fallback lexical, zéro génération d’embeddings sans activation explicite.
- [x] Apprentissage : vérifier fichiers/manifeste avant retrait d’exemples,
  nouvelle sortie privée et relecture finale, aucun entraînement/téléversement.
- [x] Effacement : base exclusivement jetable, ordre des opérations, blocages
  de conservation et propriétaire Studio, checkpoints, panne/reprise et isolation.
- [x] Offres/emails : trois plans, événements simulés idempotents et ordonnés,
  transport local injecté, échappement et reprise sans SDK fournisseur actif.
- [x] Studio/archives : navigateur → routes réelles → PostgreSQL en mémoire ;
  droits, invitations, clés API révocables et archivage de collaborations.
- [x] UX/exploitation : erreurs visibles et récupération, clavier/états vides,
  logs sans secrets et procédure de restauration locale vérifiable.
- [x] Intégration : registre, tsc, lint, unités, médias, SQL, fixtures,
  Playwright, build Next.js, bundle OpenNext, revue puis commit unique.

## Revue ciblée

Refuser les callbacks avec bail expiré, les médias d’un autre compte et les
sources supprimées/modifiées. Ne jamais annoncer une analyse IA ou un effacement
réel lorsque seules les étapes techniques/locales ont été exécutées. Conserver
la séparation des historiques Studio/personnels. Ne transmettre aucun secret
dans les logs, manifests, emails simulés ou données d’apprentissage. Laisser
les migrations nouvelles non appliquées à distance dans ce lot hors ligne.
