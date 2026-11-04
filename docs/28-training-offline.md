# Préparation trimestrielle hors ligne

Chemins : `scripts/training/dataset.mjs`, `scripts/training/export.mjs`.
Aucun appel réseau, aucune création de tâche OpenAI, aucun entraînement automatique.
Le modèle servi aux utilisateurs ne change pas.

## Exécution locale

```sh
mkdir -m 700 .local-training
openssl rand -out .local-training/key.bin 32
chmod 600 .local-training/key.bin .local-training/lot.json
npm run training:prepare -- .local-training/lot.json 2026-Q4 .local-training/key.bin .local-training/2026-Q4
npm run test:training:offline
```

Le dossier de sortie doit être nouveau. La clé stable reste hors Git et hors du
jeu de données : elle permet de retrouver les lignes d'un créateur pour retirer
ses exemples. Sa perte empêche cette correspondance. Conserver séparément,
avec un accès réservé au responsable du traitement.

## Format d'entrée

Le lot est préparé par un opérateur autorisé à partir de `rewrite_feedback`,
du consentement **actuel** dans `users.ai_training_opt_in`, et des demandes
`privacy_erasure_requests`. Les champs ci-dessous sont obligatoires ; l'export
ne remplace pas la lecture de ces sources et ne vérifie pas une base distante.
La requête `scripts/training/snapshot.sql` fournit ce relevé en transaction
de lecture seule. Elle n'est exécutée automatiquement par aucune commande.
Son résultat doit être enregistré dans un fichier privé. Elle initialise
`review_approved` à `false` : l'opérateur valide individuellement les paires.

```json
{
  "captured_at": "2026-11-04T19:00:00Z",
  "rows": [{
    "id": "identifiant-feedback",
    "user_id": "identifiant-createur",
    "original_caption": "Découvrez cette crème.",
    "accepted_caption": "PUBLICITÉ — Découvrez cette crème.",
    "prompt_version": "v1.0",
    "accepted_at": "2026-10-15T12:00:00Z",
    "training_consent_snapshot": true,
    "current_training_consent": true,
    "erasure_requested": false,
    "review_approved": true
  }]
}
```

`review_approved` atteste une relecture humaine de la paire : exactitude de la
correction, absence de faits inventés, de données sensibles et de données de
tiers. Ne jamais le définir globalement sans examen. Tout champ de consentement
manquant, faux ou de type incorrect exclut la paire. Relevé limité à 24 heures,
10 000 lignes et 20 Mio. Seules les acceptations du trimestre UTC sont retenues.

Les coordonnées courantes sont masquées, les secrets reconnaissables exclus,
les paires identiques ou dupliquées retirées. Ce traitement est une
**pseudonymisation partielle**, pas une garantie d'anonymisation : noms, adresses
postales, santé et autres informations contextuelles nécessitent une relecture.

## Fichiers produits et décision d'entraînement

- `train.jsonl` et `validation.jsonl` : messages système/utilisateur/assistant.
- `manifest.json` : correspondance pseudonyme HMAC, ligne globale et jeu ;
  la position dans chaque fichier correspond à l'ordre des entrées de ce jeu.
- `report.json` : exclusions agrégées, tailles, version et SHA-256 des deux jeux.

Le découpage est stable par créateur (environ 80/20) : ses publications ne
traversent pas les jeux. Un petit lot peut avoir un jeu vide ; cela n'autorise
pas un entraînement. La version `mentioncheck-rewrite-v1` décrit la préparation,
pas une version de modèle entraîné.

Avant toute transmission future : relecture des textes **après masquage**,
nouvelle vérification des consentements et effacements, retrait des lignes
révoquées via le manifeste, évaluation juridique et qualité, validation des
conditions fournisseur et budget explicitement autorisé. Aucun téléversement,
appel de fine-tuning, planning trimestriel ni suppression d'un modèle déjà
entraîné n'est implémenté par cette commande. Les fichiers locaux doivent être
retirés selon la politique de conservation validée ; aucun effacement automatique
n'est déclenché ici.
