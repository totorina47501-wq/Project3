# UX, logs et restauration locale

Le cockpit, les archives et les paramètres distinguent une erreur de lecture
d’un historique vide. Ils proposent une nouvelle tentative sans inventer
de score ou d’usage nul ; les filtres des archives sont conservés. Les
préférences IA exposent leur chargement et l’échec de lecture. La préparation
média conserve la légende après une erreur, indique ses statuts et permet
l’annulation des tâches en attente/en cours. Les contrôles du formulaire sont
bloqués pendant une mutation. Le score archivé ne prétend jamais résulter
d’une analyse visuelle ou d’une transcription.

`lib/security/logging.ts` ne journalise que des métadonnées opérationnelles
autorisées. Messages, stacks, causes, identifiants, légendes, emails et tokens
sont exclus. Les noms d’événements et codes sont bornés ; les retours aux
utilisateurs n’exposent pas d’erreur SDK. Cette frontière est utilisée dans
les échecs d’authentification, de PDF et d’IA existants.

## Restauration locale vérifiable

1. Sauvegarder hors Git les seuls lots locaux nécessaires dans un répertoire
   privé, avec leur clé HMAC séparée. Ne jamais copier une `.env` dans un rapport.
2. Repartir d’un checkout propre du SHA de livraison, avec Node de `.nvmrc`.
3. Exécuter `npm ci --ignore-scripts`, puis `npm run test:sql:offline` : les
   migrations reconstruisent une base jetable sans toucher à Supabase distant.
4. Exécuter `npm run test:media-jobs:offline` : les fixtures synthétiques
   vérifient traitement, idempotence, reprise et hashes des sorties.
5. Vérifier les lots d’apprentissage signés par une préparation/revocation sur
   une **nouvelle** sortie privée et les tests `npm run test:training:offline`.
6. Relancer `npm run test:privacy:offline` et `npm run test:fixtures`, puis
   Playwright, typecheck, lint, build Next.js et bundle OpenNext.

Ne pas lancer de restauration distante, `db reset`, suppression d’objets,
rotation de clés ou rollback d’archives avec cette procédure. La restauration
des données réelles et l’essai des sauvegardes des prestataires restent une
opération distincte, à préparer sur un environnement autorisé.
