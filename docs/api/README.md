# API B2B MentionCheck — intégration serveur

**État :** contrat et SDK de développement. L'existence du code et une CI verte ne démontrent pas la disponibilité commerciale ni un test distant de l'API authentifiée.

L'API Studio existante expose uniquement le contrôle textuel **sans IA**. Ne pas confondre avec `/api/check` (session utilisateur) ni avec les routes Mia.

## Prérequis

Un propriétaire disposant du plan Studio actif crée un espace puis une clé via le tableau de bord Studio. La clé doit porter `checks:write` pour POST et `checks:read` pour GET. Elle expire après 90 jours au maximum et peut être révoquée. La validité, les scopes, le plan et l'appartenance sont vérifiés côté serveur. Conserver la clé dans les secrets de votre backend, **jamais** dans le navigateur, Git ou une application mobile distribuée.

## Exemple HTTP

```bash
curl -X POST 'https://mentioncheck.toto-rina47501.workers.dev/api/v1/check' \
  -H "Authorization: Bearer $MENTIONCHECK_API_KEY" \
  -H 'Content-Type: application/json' \
  --data '{"caption":"Publicité : partenariat rémunéré.","platform":"instagram"}'
```

Réponse de succès : HTTP 201 avec `{"verification":{...}}`. Pour consulter les 100 dernières vérifications de l'espace autorisé : `GET /api/v1/verifications` (scope `checks:read`).

## Exemple TypeScript (backend)

```ts
import { MentionCheckClient } from './sdk/mentioncheck';

const client = new MentionCheckClient({
  apiKey: process.env.MENTIONCHECK_API_KEY!,
});
const result = await client.check({
  caption: 'Publicité : partenariat rémunéré.',
  platform: 'instagram',
});
console.log(result.verification);
```

Le SDK est **un fichier source local**, non publié sur npm. Copier ou importer le module depuis un backend TypeScript ; ne pas l'exposer au frontend. `MentionCheckApiError.status` donne le statut HTTP. Les requêtes acceptent un `AbortSignal` et un délai configurable.

## Contrat et limitations

- Spécification : [openapi.yaml](openapi.yaml), OpenAPI 3.1.
- Plateformes : instagram, tiktok, youtube, linkedin ; légende entre 1 et 10 000 caractères.
- JSON strict, 64 Kio maximum ; pas de média, pas d'IA, pas de sélection libre de workspace.
- 401 : clé absente ou syntaxe invalide ; 403 : clé non autorisée, expirée ou révoquée ; 409 : conflit ; 413 : corps trop volumineux ; 429 : limitation ; 503 : dépendance indisponible.
- Aucun endpoint de facturation API, d'analyse Mia ou de quota public documenté n'est actuellement garanti.
- Le contrôle produit un résultat informatif, pas un avis juridique ni une certification.

## Avant ouverture commerciale

Vérifier l'API authentifiée sur l'environnement cible avec un compte Studio de recette, les scopes, l'expiration, les erreurs, les limites, les quotas, l'isolation inter-équipes, l'observabilité et les conditions contractuelles. Ne pas activer de paiement live par ce lot.
