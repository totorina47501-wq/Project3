# Instructions GitHub Copilot — MentionCheck

## Contexte et reprise
MentionCheck est un SaaS français de contrôle de conformité des contenus d'influence commerciale. Stack réelle : Next.js 15 App Router, React 19, TypeScript strict, Supabase PostgreSQL/RLS, OpenAI, Cloudflare Workers/OpenNext et Playwright.

**Avant toute édition**, lire `REPRISE.md`, `docs/work-registry.json`, la documentation du domaine concerné et les PR/issues ouvertes. Le registre recense les fonctionnalités, routes, migrations et tests existants : ne rien recréer sans vérification.

## Collaboration avec plusieurs agents
- Travailler sur **une branche propre à une seule issue** (`copilot/<sujet>`) et soumettre une PR ; ne jamais pousser directement sur `main`.
- Vérifier les PR et branches ouvertes. S'abstenir de modifier des fichiers déjà travaillés par un autre agent et signaler les conflits dans la PR.
- Respecter strictement le périmètre de l'issue. Pas de refonte transversale, nouvelle dépendance, migration ou modification d'algorithme sans justification et autorisation.
- Le chantier **Mia/RAG/corpus juridique/indexation** est réservé aux autres agents tant qu'une issue ne l'attribue pas explicitement à Copilot. Ne pas relancer l'indexation initiale 5/5 ni importer de textes juridiques non validés.
- L'API B2B Studio/SDK est en cours sur la PR #31 : ne pas modifier les mêmes fichiers en parallèle avant sa fusion ou sa clôture.
- Ne pas modifier les algorithmes métier de conformité, les politiques RLS, les règles de prix ou la logique de paiement pour une tâche documentaire ou UX.

## Garde-fous de sécurité et coûts
- Aucun accès ou changement sur les données de production, secrets, tokens, tables Supabase distantes, déploiements Cloudflare ou paiements live.
- Ne lancer aucun appel payant OpenAI ni aucune opération de purge/rétention. Respecter les indicateurs `OPENAI_PAUSED` et les autres interrupteurs de la CI.
- Ne jamais exposer de données personnelles, clés, cookies, logs sensibles, URL signées ou détails d'erreur internes.
- Authentification et autorisation côté serveur, isolation de tenant et contrôles RLS sont des invariants. Valider la logique locale sans contourner ces protections.

## Qualité et livraison
- Node conforme à `.nvmrc` et `npm ci --ignore-scripts`.
- Contrôles de base : `npm run work:check`, `npm run work:test`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
- Selon le périmètre, utiliser les tests locaux existants : `npm run test:fixtures`, `npm run test:e2e`, `npm run test:sql:offline`, `npm run test:privacy:offline` et les suites média. N'exécuter les tests SQL que sur une base locale jetable.
- Ne pas recopier des tests Playwright ou fonctionnalités existants. Ajouter le test de non-régression minimal qui démontre le changement.
- La CI `.github/workflows/ci.yml` s'exécute sur les PR et sur `main`. Ne pas la contourner ; corriger toute erreur causée par la PR.
- Mettre à jour la documentation pertinente et le registre seulement lorsqu'une route/fonctionnalité réellement nouvelle l'exige.

## PR attendue
Une PR ciblée et relisible, avec : écart identifié après audit, fichiers modifiés, tests exécutés et résultats, impacts de sécurité, et distinctions explicites entre **code ajouté**, **CI validée**, **base migrée**, **fonctionnalité déployée** et **recette production**. Ne jamais dire « déployé » sur la seule base d'une CI verte.

Ne fusionner aucune PR sans validation du propriétaire.
