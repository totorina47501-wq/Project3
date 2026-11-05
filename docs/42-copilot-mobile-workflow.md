# Déléguer une tâche à un agent depuis GitHub Mobile

1. Ouvrir les [issues MentionCheck](https://github.com/totorina47501-wq/Project3/issues).
2. Choisir une issue explicitement réservée à Copilot et vérifier que son périmètre n'est pas déjà couvert par une PR ouverte.
3. Dans **Assignees**, choisir **Copilot** (et non un utilisateur humain). L'assignation lance une session cloud si Copilot cloud agent est activé dans le dépôt.
4. Vérifier la PR brouillon créée par Copilot, les fichiers modifiés, les tests et la CI. Ne pas fusionner tant que les exigences et vérifications ne sont pas satisfaites.
5. Pour lancer une recherche autonome sans issue, utiliser [GitHub Agents](https://github.com/copilot/agents), sélectionner ce dépôt et envoyer un prompt circonscrit.

## Configuration de compte (manuelle)

L'abonnement Copilot Pro permet le cloud agent, sous réserve des politiques du compte et du dépôt. Si l'option Copilot n'apparaît pas parmi les assignees, vérifier les [paramètres Copilot coding agent](https://github.com/settings/copilot/coding_agent) et autoriser ce dépôt. L'activation des agents partenaires Claude et Codex est optionnelle et se fait également dans les paramètres de compte ; **aucune activation n'est requise pour utiliser le seul agent Copilot**.

Ces réglages personnels ne peuvent pas être activés via les fichiers du dépôt. Les instructions communes sont définies dans `.github/copilot-instructions.md` ; elles seront disponibles sur la branche par défaut après fusion de la PR de configuration.

## Règles de séparation des tâches

- Copilot : première issue pilote documentaire ou de test, sans données de production.
- ChatGPT/Codex : Mia et RAG ; API B2B en cours sur PR #31.
- Ne pas assigner la même issue à plusieurs agents sans protocole de comparaison et branches séparées.

## Validation

Les PR passent la CI existante `.github/workflows/ci.yml` (sans appels payants OpenAI ni déploiement). La création d'une issue ou sa délégation ne garantit pas la disponibilité d'un agent, une réussite CI ou une fusion.
