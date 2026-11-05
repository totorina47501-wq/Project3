# Validation réelle du Worker et consolidation — 5 novembre 2026

La configuration OpenAI existante du Worker est réutilisée. Aucune clé API
n’est créée, extraite du Worker ou enregistrée dans le dépôt. Le compte
technique de validation est isolé, marqué `validation_fixture` et utilise
uniquement des contenus fictifs. Son secret et sa session restent dans un
répertoire temporaire privé ; aucun email n’est envoyé.

## Périmètre de recette

1. Connexion réelle via `/api/auth/login` et session Supabase.
2. Contrôle texte avec exécution IA explicite, signaux déterministes et
   proposition de réécriture comportant une mention commerciale visible.
3. Préparation d’un PNG fictif, transfert direct dans le bucket privé,
   confirmation serveur et SHA-256 persisté.
4. Contrôle texte + Vision sur cette image, sans données personnelles.
5. Question à Mia sur la transparence commerciale, citations officielles et
   coûts des embeddings/réponses rattachés au compte.
6. Lecture des métriques par propriétaire, vérification de l’absence de
   secrets dans les résultats et conservation des données de preuve.

Les appels payants ne sont pas exécutés par la CI. Les tests automatiques
utilisent des mocks ; la recette réelle passe par le Worker déployé et ses
identifiants existants. Elle n’autorise ni paiement Stripe, email réel,
entraînement, réindexation complète, purge ou suppression de production.

## Constats ayant motivé le correctif

La connexion, le transfert privé et la persistance du SHA-256 ont fonctionné
sur l’application déployée. GPT-4o a effectivement analysé le premier texte
avec un usage enregistré. Les premiers essais ont cependant retourné un
mode partiel pour la réécriture et pour Vision ; ils ne doivent pas être
comptés comme des validations complètes de ces fonctions.

Le client utilise désormais `zodResponseFormat` du SDK officiel et impose
un JSON Schema strict, tout en conservant la validation locale Zod. Un
résultat tronqué, vide, refusé ou non conforme est distingué sans exposer son
contenu. Les métriques d’une réponse invalide restent disponibles pour la
journalisation du coût ; les événements SSE renvoient seulement une catégorie
d’erreur contrôlée. Aucun retry potentiellement facturé n’est ajouté.

Les recettes après déploiement doivent vérifier `analysisMode=full`, une
réécriture non vide pour le cas sponsorisé, un journal Vision réel et des
citations Mia issues du corpus. Un HTTP 200 avec mode dégradé ne suffit pas.

## Migrations réellement appliquées

| Source locale | Nom distant | Version distante |
|---|---|---|
| `20261104225500_media_processing_queue.sql` | `media_processing_queue` | `20261105000826` |
| `20261105003500_ai_usage_ownership.sql` | `ai_usage_ownership` | `20261105003303` |

Empreintes SHA-256 des sources appliquées :

```text
media_processing_queue  33a419c706ed37a582be3517fd324871dad5e6bd82efdec11f6eb2a1ed32f835
ai_usage_ownership      cd17c716994355c24a5b34b5e7a813f481bd836c906f6c67cf6c20a6e9099c94
```

La file contient initialement zéro job et aucune exécution n’est lancée.
Les RPC restent réservées au serveur et les jetons de bail ne sont pas
lisibles par les sessions utilisateur. Les deux tables ont RLS activée.

L’attribution des coûts conserve la compatibilité des anciens appels liés à
une vérification. Les conversations Mia et embeddings peuvent être tracés
sans créer une fausse vérification. L’export RGPD filtre désormais les
métriques directement par propriétaire. Les lectures croisées et insertions
client sont refusées par les tests SQL locaux. Le contenu brut des réponses
et questions n’est pas ajouté aux métriques.

Le corpus juridique distant est déjà indexé 5/5 et sa migration d’invalidation
est appliquée. Le registre a été corrigé pour éviter ces doubles opérations.
Le traitement média distant et ses flags ne sont pas activés par ces DDL.

## Offre Solo

Le prix Solo est maintenant reconnu par le checkout et les webhooks de test,
avec refus des configurations ambiguës. Un prix absent est refusé avant de
créer un client fournisseur. La simulation réutilise la même traduction des
tarifs. `BILLING_ENABLED` reste désactivé par défaut et le mode live est
toujours refusé.

## Lecture des résultats

Les coûts applicatifs sont des estimations calculées à partir des tokens
retournés. Les anciens essais échoués avant ce correctif peuvent ne pas avoir
de métriques complètes ; ils ne permettent pas de reconstituer une facture.
Le relevé OpenAI reste la référence de facturation. Le compte technique et
les preuves sont conservés sans effacement de production.
