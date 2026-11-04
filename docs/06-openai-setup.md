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


## Vérification rétrospective de l'incident 429 — 4 novembre 2026

**Preuves observées, sans nouvel appel OpenAI :** le 3 novembre 2026 à 23:22 UTC (4 novembre à 00:22 à Paris), le Worker a journalisé `stage=text`, `category=credit`, HTTP `429`. Un crédit API de 10 USD et une recharge automatique désactivée avaient été contrôlés lors du diagnostic, mais le solde actuel et l'association précise entre clé Cloudflare et projet OpenAI ne peuvent pas être vérifiés par lecture des fichiers GitHub.

Une consultation **en lecture seule** de Supabase le 4 novembre révèle toutefois deux vérifications avec `analysisMode=full` et quatre enregistrements réussis `ai_analyses` :
- 3 novembre 23:23:46 UTC : vérification complète avec **analyse texte GPT-4o et réécriture GPT-4o** ;
- 3 novembre 23:26:50 UTC : deuxième vérification complète avec **analyse texte GPT-4o et réécriture GPT-4o**.

**Conclusion :** l'erreur 429 initiale n'était plus bloquante quelques minutes plus tard. Ces succès ne prouvent pas la validité future du crédit ni la disparition définitive des erreurs 429 ; ils suffisent à réfuter le diagnostic d'une panne persistante au moment des dernières vérifications enregistrées. **Ne pas recréer de clé, recharger le compte ni modifier un secret Cloudflare pour cette seule erreur historique.** Aucun appel IA réel n'a été lancé pour ce diagnostic.

Le connecteur OpenAI Platform accessible depuis cette conversation liste une organisation « Personal » et un « Default project » uniquement. Ce résultat **ne permet pas** de déterminer à quel projet appartient la clé actuellement stockée dans Cloudflare. La clé n'est pas lisible via GitHub, et les droits de facturation, les limites du projet et le solde instantané ne sont pas exposés par ce connecteur.

### Si une nouvelle erreur 429 se produit

1. Examiner `[mentioncheck][ai_failure]` dans l'observabilité Cloudflare en comparant `category`, `stage` et heure UTC. `credit` et `rate_limit` sont déjà distingués dans le code ; ne pas assimiler tout HTTP 429 à un défaut de crédits.
2. Dans OpenAI Platform, vérifier **l'organisation API** qui possède le solde, le projet associé à la clé déjà déployée, ses permissions d'accès à `gpt-4o`, les limites d'utilisation et les éventuels plafonds de dépenses, sans exposer la valeur de la clé.
3. Vérifier les paramètres de facturation sans déclencher d'achat ou de recharge : un solde positif ne garantit pas l'absence de restriction d'organisation/projet. La coupure applicative `OPENAI_PAUSED=true` reste disponible si besoin.
4. Ne lancer aucun essai réel GPT-4o sans autorisation explicite. Un test de compilation, de lecture de base ou de contrôle d'environnement ne constitue **pas** une preuve que l'inférence fonctionne à cet instant.

Références fournisseurs : https://help.openai.com/en/articles/6614457-troubleshooting-api-usage-and-spend-limits et https://help.openai.com/en/articles/9186755-managing-projects-in-the-api-platform .
