# RAG et apprentissage sans fournisseur actif

Le RAG de `lib/mia/retrieval.ts` et son classement hybride ont été intégrés
par les commits distants de main pendant ce lot. Leur implémentation est
conservée, sans seconde recherche concurrente. Par défaut, le classement
reste lexical. Le chemin vectoriel exige un index complet, le modèle attendu
et les activations existantes. Les tests remplacent intégralement Supabase et
la génération d’embeddings par des mocks : index partiel, fournisseur en panne,
RPC indisponible, source non fiable et repli lexical sont exercés sans coût.

Les références et URL de la RPC doivent appartenir au corpus validé. Les
citations sont dédupliquées et limitées aux références officielles fournies,
sans transmettre les extraits éditoriaux dans la liste des citations. La
réponse sans document pertinent ajoutée à main est conservée sans appel IA.

La fonction pgvector existe déjà. Son index et son opérateur ne sont pas
exercés par PGlite : les tests simulent les correspondances vectorielles.
Aucun embedding n’a été généré ni aucun réglage distant modifié dans ce lot.
Les outils d’indexation et l’interface administrateur ajoutés à main restent
préservés, sans être exécutés ou activés ici.

## Retirer des exemples d’un lot local

Les nouveaux exports `training:prepare` produisent aussi `integrity.json` :
HMAC du manifeste et du rapport, lequel contient les SHA-256 des JSONL. La
commande suivante vérifie tous les fichiers avant de créer un nouveau lot.

```sh
npm run training:revoke -- .local-training/2026-Q4 .local-training/revocations.json .local-training/key.bin .local-training/2026-Q4-revoque
```

Le fichier privé de révocations contient un relevé frais de moins de 24 heures :

```json
{
  "captured_at": "2026-11-04T23:00:00Z",
  "review_approved": true,
  "user_ids": ["identifiant-createur-revoque"],
  "feedback_ids": ["identifiant-feedback-a-retirer"]
}
```

Utiliser la même clé HMAC, conserver le dossier en mode 700 et les fichiers
en mode 600. Les identifiants bruts n’apparaissent pas dans les sorties.
L’original n’est jamais modifié ; le nouveau manifeste est renuméroté,
les jeux conservent leur partition et les empreintes sont recalculées.
Une mauvaise clé, une altération ou une liste périmée échoue avant écriture.
Un lot entièrement révoqué produit deux fichiers vides sans lancer de modèle.
Les anciens lots non signés doivent être reconstruits depuis une source
relue, pas signés aveuglément. Protéger ou retirer leurs copies selon la
politique de conservation : cette commande ne les efface pas automatiquement.

## Comparaison de corrections déjà disponibles

`evaluateRewriteCandidates(input)` dans `lib/ai/evaluation.ts` compare un jeu
identifié et relu : `id`, `platform`, `approvedCaption`, `baselineCaption`,
`candidateCaption`. Il retourne les différences de divulgation explicite,
correspondance exacte et score heuristique moyen. Les textes ne figurent pas
dans le rapport ; un jeu vide ou dupliqué est refusé. Les régressions restent
visibles. Le résultat exige une revue humaine et interdit une promotion
automatique : il ne mesure pas à lui seul la qualité juridique ou sémantique.

```sh
npm run test:training:offline
npm test -- --run tests/unit/mia-vector-retrieval.test.ts tests/unit/rewrite-evaluation.test.ts
```

Aucun téléversement, entraînement, changement de modèle servi ou programmation
trimestrielle n’est déclenché par ces fonctions.
