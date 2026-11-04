# Paramètres internes et modèles d’emails

État du code : comptes sociaux déclarés manuellement, préférence de tonalité
persistée et quatre emails rendus localement. Aucun OAuth, envoi Resend ou appel
IA n’est déclenché par ces paramètres. La dépendance `resend` existait déjà ;
elle n’est ni importée ni initialisée par cette livraison.

## Comptes déclarés

La page `/dashboard/settings` affiche les métadonnées autorisées de
`social_accounts` : plateforme, nom, date et `connection_kind`.

- `manual` : déclaration créée dans MentionCheck, modifiable et retirable.
- `unknown` : ligne historique dont la connexion n’a pas été vérifiée, en lecture seule.
- `oauth` : valeur réservée à une intégration fournisseur future ; l’interface
  précise que l’état fournisseur n’est pas vérifié ici.

Aucune colonne Vault n’est sélectionnée, insérée, mise à jour ou retournée.
La suppression d’une déclaration retire seulement la ligne de métadonnées ;
elle ne touche aucun réseau social, média, archive ou jeton fournisseur.

`GET /api/social-accounts?page=1` lit les lignes du propriétaire par pages de 25.
`POST /api/social-accounts` crée une déclaration ; `PATCH` et `DELETE` sur
`/api/social-accounts/[id]` modifient/retirent une déclaration possédée.
Les objets JSON autorisent seulement `platform` et `handle`. Les noms sont
normalisés en minuscules sans `@`, bornés à 200 caractères et refusent les liens
ou espaces. Les corps sont limités à 2 048 octets, y compris sans Content-Length.

Les RPC `save_social_account` et `remove_social_account` vérifient `auth.uid()`
et le propriétaire, et verrouillent sa ligne `users` pendant la transaction.
Le quatrième compte Solo est refusé atomiquement, même avec deux créations
concurrentes. Le total comprend aussi les comptes historiques. Aucune limite
commerciale supplémentaire Pro/Studio n’est inventée et aucun formulaire ne
peut modifier le plan. Les écritures directes de `social_accounts` restent interdites.

## Tonalité

`user_preferences` conserve `user_id`, `rewrite_tone` et `updated_at`.
Les valeurs sont celles du moteur existant : `naturel`, `créatif`, `institutionnel`.
Les politiques RLS limitent chaque lecture/écriture au propriétaire ; le plan et
le consentement d’entraînement demeurent indépendants.

`GET` et `PUT /api/social-accounts/preferences` lisent/enregistrent
`{ "rewriteTone": "créatif" }`. Le moteur `runCheck` lit ce choix uniquement
avant la réécriture déjà autorisée par son flux et son quota existants. Il garde
`naturel` si la table manque, si la lecture échoue ou si la valeur est invalide.
Aucun nouvel appel IA n’est ajouté. Le parcours sans IA est inchangé.

Les routes exigent une session, une origine explicite identique pour chaque
mutation et renvoient `Cache-Control: private, no-store`, y compris en erreur.
Les erreurs SDK sont masquées par `publicError`.

## Emails locaux

`lib/email/templates.ts` expose `renderEmail` (union de paramètres typée) et
`emailPreviews`. Chaque rendu contient `subject`, `text` et `html` en français :

1. `welcome` : accueil et premier contrôle sans IA.
2. `report-ready` : rapport disponible dans l’espace privé, sans contenu personnel.
3. `quota-warning` : usage/limite/période, sans proposition de paiement actif.
4. `erasure-received` : accusé de demande, précisant qu’aucune suppression automatique n’a été lancée.

Les données HTML sont échappées, les identifiants et dates validés, les origines
limitées à HTTPS sans identifiants, chemin, paramètres ou fragment. Les liens
ciblent uniquement les routes internes fixes. Aucun destinataire ni fonction
d’envoi n’est défini. Ces modèles ne prouvent aucun envoi effectif.

Rendu reproductible sans réseau (Node 22.12+), depuis la racine du dépôt :

```sh
node --experimental-strip-types --input-type=module <<'JS'
import { mkdirSync, writeFileSync } from 'node:fs';
import { emailPreviews } from './lib/email/templates.ts';
const directory = '/tmp/mentioncheck-email-previews';
mkdirSync(directory, { recursive: true });
for (const { name, email } of emailPreviews('https://local.test')) {
  writeFileSync(`${directory}/${name}.html`, email.html);
  writeFileSync(`${directory}/${name}.txt`, email.text);
}
JS
```

## Validation et activation restante

Tests hors réseau : `internal-settings.test.ts`, `social-routes.test.ts`,
`internal-settings-render.test.ts`, `rewrite-preferences.test.ts`,
`email-templates.test.ts`. Ils couvrent validation, CSRF, session, masquage
SDK, réponses privées, transmission de la tonalité au moteur et rendu réel des
composants/emails. Les fournisseurs IA sont remplacés uniquement aux frontières
des tests ; aucune requête SDK ne sort de la suite.

`tests/sql/settings_security.sql` est destiné à PostgreSQL local jetable après
les migrations : propriété croisée, quota Solo, doublons, retrait libérant une
place, comptes historiques intouchables, grants et RLS de préférences.
Le verrou du profil sérialise les mutations ; sa course concurrente doit aussi
être vérifiée par le harnais SQL local de livraison.

La proposition initiale de schéma est remise au parent dans
`/tmp/mentioncheck-settings.sql` ; ce fichier temporaire n’est pas la migration
du dépôt. Le parent intègre la migration et le registre. Une migration intégrée
au code ne signifie pas qu’elle a été appliquée à une base distante.

Restent externes : autorisations et validation OAuth pour chaque réseau,
configuration de domaine/expéditeur Resend, choix des déclencheurs et obligations
d’information applicables avant tout envoi. Aucun de ces points n’empêche le
rendu local ni la gestion interne après application séparée de la migration.
