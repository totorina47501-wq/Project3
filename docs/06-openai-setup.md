# MentionCheck — préparer OpenAI sans consommer de crédit

**État au 4 novembre 2026 :** code de préparation ajouté, sans lancer de requête
OpenAI ni Stripe. Ce document ne prouve pas la configuration réelle du
projet OpenAI ni la validité d'une clé Cloudflare existante.

## 1. Ce qui existe et ce qui reste désactivé

| Besoin | Modèle | État technique |
|---|---|---|
| Analyse texte, image, réécriture et Mia | `gpt-4o` | Déjà câblé ; seulement à la demande de l'utilisateur |
| Vidéos : transcription d'un WAV validé par FFmpeg | `gpt-transcribe` | Adaptateur serveur prêt, non raccordé et désactivé |
| Recherche documentaire vectorielle | `text-embedding-3-small` (1536 dimensions) | Adaptateur prêt, non raccordé et désactivé |

La transcription via `whisper-1` et `gpt-4o-mini-transcribe` est dépréciée
à la date de ce document, avec retrait annoncé le 26 février 2027.
**Pour du code neuf, utiliser `gpt-transcribe`.** Référence :
https://developers.openai.com/api/docs/guides/speech-to-text

Le modèle historique `gpt-4o` est conservé pour éviter une régression des
schémas de réponses tant que les tests métier payants sont suspendus.
Son statut et un futur remplacement doivent être revus avant lancement
commercial : https://developers.openai.com/api/docs/models/gpt-4o.

## 2. Clés, projet et facturation OpenAI

1. Utiliser un **projet OpenAI dédié MentionCheck** et une clé API propre
   à ce projet. L'ancienne clé peut rester en place tant qu'elle fonctionne ;
   ne pas la révoquer à l'aveugle.
2. Dans https://platform.openai.com/settings/organization/projects ,
   vérifier les droits de la clé et configurer un budget bas, des alertes
   et les limites d'utilisation du projet, selon les possibilités du compte.
3. Dans Cloudflare, configurer `OPENAI_API_KEY` comme **Secret serveur**,
   jamais comme `NEXT_PUBLIC_` ni dans GitHub. Éviter les logs de contenu.
4. Un budget/alerte sur le portail OpenAI n'est pas nécessairement une
   coupure stricte des dépenses. Pour une pause assurée par l'application,
   définir `OPENAI_PAUSED=true` dans les secrets/variables Cloudflare.
5. Le statut des capacités est consultable dans **Paramètres** : il
   révèle uniquement un booléen de présence de clé, jamais son contenu
   ni un résultat d'appel réseau.

## 3. Fonctions et drapeaux (environnement serveur uniquement)

```dotenv
OPENAI_PAUSED=false
OPENAI_TEXT_ENABLED=true
OPENAI_VISION_ENABLED=true
OPENAI_AUDIO_ENABLED=false
OPENAI_EMBEDDINGS_ENABLED=false
```

- `OPENAI_PAUSED=true` est la coupure globale : toute tentative d'appel
  est bloquée avant de construire le client SDK.
- `OPENAI_AUDIO_ENABLED=false` et `OPENAI_EMBEDDINGS_ENABLED=false`
  sont les **valeurs par défaut**, même si les variables manquent.
- Le texte et les images restent compatibles avec l'existant, tant que
  leur drapeau ne vaut pas `false`. Ils consomment des crédits si un
  utilisateur choisit explicitement l'IA ; les tests automatisés ne
  doivent jamais choisir ce mode.
- Aucune route publique nouvelle ne déclenche audio/embeddings.
  L'activation du drapeau seul ne raccorde pas le traitement vidéo.

## 4. Limites de ressources et protection des coûts

- SDK serveur avec `timeout=30s`, `maxRetries=0` et maximum
  **2 500 tokens** de réponse Chat Completions.
- Avant transcription, adapter un **WAV RIFF/WAVE** de
  **44 octets à 3 Mio**, durée **0 à 60 secondes** (strictement positive).
  Le WAV réel devra être produit par le processeur isolé, puis
  téléchargé via un job autorisé, jamais fourni via une URL arbitraire.
- Avant embedding, texte de 3–5 000 caractères, vecteur attendu
  de 1 536 dimensions finies.
- Les coûts affichés en code sont seulement des **estimations** :
  `gpt-4o` $2.50/1M tokens entrants et $10/1M sortants,
  `gpt-transcribe` $0.0045/min, `text-embedding-3-small`
  $0.02/1M tokens entrants. Réévaluer tarifs avant facturation.
- Les quotas Supabase `check`, `rewrite` et `mia`
  restent en place et séparés des plafonds globaux du fournisseur.
  Ils ne remplacent pas une maîtrise globale des dépenses OpenAI.
- Ne pas se fier aux seuls calculs de coût : vérifier Usage/Billing
  côté Platform lorsque des appels sont autorisés.

Prix vérifiés :
https://developers.openai.com/api/docs/models/gpt-4o
https://developers.openai.com/api/docs/models/gpt-transcribe
https://developers.openai.com/api/docs/models/text-embedding-3-small

## 5. Test et validation sans consommation

- `bun run typecheck`, `bun run lint`, `bun run test`, `bun run build`.
- Tests Vitest de drapeaux, kill-switch, formats WAV, dimensions vectorielles,
  estimation de prix et absence de secrets dans l'état.
- Le blocage réseau Vitest reste actif ; **aucune requête OpenAI réelle**
  n'est exécutée. La compilation seule ne prouve ni les permissions du
  projet, ni la clé, ni les quotas du compte.
- Avant mise en production, choisir explicitement une fenêtre de test
  avec budget approuvé ; valider consentement, DPA, conservation, logs
  et suppression des copies de médias/transcriptions.

## 6. Suite avant les vidéos réellement analysées

Service de traitement isolé avec file de jobs sécurisée, consentement du
créateur, isolation du fichier et nettoyage, suivi des coûts par vérification,
transcription volontaire, analyse Vision des frames et fusion des anomalies.
Aucun traitement autonome coûteux ni import automatique des embeddings
n'est autorisé à ce stade.
