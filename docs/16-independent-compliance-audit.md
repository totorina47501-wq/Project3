# Audit indépendant — moteur de conformité MentionCheck

Date : 2026-11-04
Branche : `feat/mentioncheck-independent-compliance-audit`
Périmètre : audit en lecture seule du code de la branche Codex au moment de la création de cette branche. Aucun appel OpenAI ni modification de production.

## Constat vérifié dans le code

- `lib/ai/rules.ts` implémente R1, R2, R3, R5, R6 et R7. R2, R3 et R7 sont des heuristiques de présentation, non des seuils légaux autonomes.
- R4 est décrite dans `supabase/seed.sql` mais la détection de marque visuelle devient un `aiFlag` dans `lib/ai/mentioncheck-engine.ts` et non une violation juridique automatique. Ce comportement évite d'inférer une rémunération du seul logo.
- R8 désigne une preuve technique SHA-256, pas une violation ; `applyRules` n'a pas à produire R8.
- `runCheck` et `runRulesOnlyCheck` calculent le hash d'un manifeste contenant légende, plateforme, type et chemin média, **pas des octets du média**.
- `riskFrom` somme des pénalités (low=6, medium=18, high=32, critical=55), ajoute au plus 5 points liés à la confiance IA et plafonne à 100 ; le score de conformité est `100-risk`. Il mesure les signaux détectés, non la conformité juridique complète.
- `analyzeVisual` refuse actuellement les types autres que `image`. Ne pas confondre extraction vidéo hors ligne et analyse vidéo IA opérationnelle.
- Les tests `tests/unit/rules.test.ts` couvrent les cas de base, mais pas une matrice complète de variations de casse, accents, faux positifs et contexte commercial.

## Corrections à réaliser dans ce lot indépendant

### P0 — Preuve média et traçabilité
1. Calculer l'empreinte SHA-256 des octets du média lors de l'ingestion, côté environnement de confiance.
2. Enregistrer séparément `media_sha256` et une version canonique du manifeste de preuve ; conserver les empreintes historiques inchangées.
3. Prévoir une migration additive avec RLS, sans écraser les archives.
4. Tests : média identique => même hash ; un octet modifié => hash différent ; refus des chemins appartenant à un autre utilisateur ; hash non fourni par le client sans validation.

### P0 — Lisibilité du score
1. Présenter distinctement `analysisMode=full|partial|rules_only`, les sources utilisées et les limites du contrôle.
2. Éviter « validé juridiquement » et « certifié conforme » ; afficher « aucun signal détecté par les contrôles exécutés » quand le score vaut 100.
3. Tests : panne texte => mode rules_only ; panne vision => partial ; aucun résultat IA n'est inventé ; quota remboursé selon les règles existantes.

### P0 — Matrice de non-régression
| Cas | Attendu |
|---|---|
| `PUBLICITÉ — présentation` | R1 absent |
| `Collaboration commerciale — présentation` | R1 absent |
| `Merci @marque #collab` | R1 et R6 signalés |
| Lien `?aff=123` sans divulgation | R1 et R5 signalés |
| Mention explicite après 125 caractères | R2 heuristique |
| Mention dans une longue queue de hashtags | R3 heuristique si les conditions du détecteur sont réunies |
| Logo sans contrepartie connue | observation visuelle, aucune présomption de partenariat |
| `PUBLICITÉ — code promo` en début | aucune obligation inventée de gras ou majuscules |
| R8 | aucun code de violation R8 |
| Mode sans IA | aucun appel réseau payant, score présenté comme provisoire |

### P1 — Gouvernance des règles
- Versionner indépendamment les règles déterministes et les prompts.
- Enregistrer la version réellement exécutée dans chaque vérification.
- Conserver les sources, leur date de vérification et la distinction loi / heuristique / technique.
- Vérifier les références sur Legifrance et DGCCRF avant tout changement juridique.

## Protocole de validation et fusion

- Tester hors ligne : TypeScript strict, lint, Vitest, SQL sur base jetable, build et E2E réalisables sans service payant.
- Ne pas activer OpenAI, Stripe, Resend, embeddings ou fine-tuning.
- Ne jamais modifier la branche Codex, sa PR ni `main`.
- Avant fusion future : comparer les fichiers de cette branche avec la dernière version Codex, repérer les doublons, résoudre les migrations concurrentes et relancer la CI.
- Statut du présent document : **audit et plan de tests**. Les correctifs P0/P1 ci-dessus ne sont pas déclarés implémentés.
