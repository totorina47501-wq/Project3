# Raccordement du runner média existant

Choix retenu : processus Node Unix séparé, utilisant le SDK Supabase existant,
les RPC de baux et les processeurs FFmpeg/Sharp existants. Aucun appel IA.

1. Écrire les tests : file RPC et Storage simulé, décodage réel ; erreurs de
   hash, propriété, upload, relecture distante, annulation et bail perdu.
2. Ajouter un adaptateur distant qui télécharge sous racine temporaire privée,
   vérifie les SHA-256, publie et relit les artefacts avant finalisation CAS.
3. Ajouter une commande opt-in, bornée dans le temps, avec arrêt sur signal,
   temporisation et logs minimisés. Ne pas démarrer sur simple import.
4. Préparer un bucket dérivé privé et un conteneur Node/FFmpeg non privilégié.
   Conserver tous les flags applicatifs désactivés.
5. Exécuter les régressions médias, SQL, unitaires, TypeScript, lint,
   Playwright et build ; construire le conteneur si Docker est disponible.
6. Mettre à jour REPRISE et le registre ; publier un commit sur main après
   comparaison du HEAD distant. Signaler l’hébergement/les secrets encore absents.

Les tests utilisent des fichiers synthétiques et un PostgreSQL local jetable.
Aucune suppression Storage ni activation de traitement de production.
