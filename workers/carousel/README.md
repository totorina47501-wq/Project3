# MentionCheck — carrousels préparés hors IA

Le processeur local `workers/carousel/src/process.mjs` prend 2 à 5 fichiers
JPEG/PNG/WebP privés (8 Mio maximum chacun), vérifie leur en-tête avec Sharp,
refuse les images corrompues et animées, gère l'orientation EXIF, produit des
WebP optimisés sans métadonnées originales et un manifeste SHA-256.

Exécution sur un hôte isolé avec les dépendances du projet installées :

    node workers/carousel/src/process.mjs ./sortie ./image1.jpg ./image2.png
    node --test workers/carousel/tests/carousel.test.mjs

Aucun appel réseau, aucune requête OpenAI, ni analyse de conformité n'est
effectué. Les sorties sont créées dans un répertoire temporaire privé, puis
publiées par renommage atomique. Un verrou évite les collisions entre
processeurs coopérants. Ne pas exposer ces dossiers en accès public.

Ce module ne traite **pas** encore les médias depuis l'interface SaaS :
un service de traitement isolé reste nécessaire.
L'exécuteur de jobs local avec reprise vérifiée et annulation est décrit dans
`../media-jobs/README.md` ; il réutilise ce processeur.
