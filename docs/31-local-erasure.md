# Effacement exécutable sur base jetable uniquement

`scripts/privacy/local-erasure.mjs` crée sa propre base PGlite **en mémoire**.
Sa fabrique n’accepte aucune option, URL, chemin de base ou client SQL fourni.
L’exécuteur n’accepte que les instances créées par cette fabrique (WeakMap).
Il ne connaît aucun SDK Auth/Storage, aucune clé fournisseur et aucune route
de production. Le workflow public reste en prévisualisation/dry-run.

```sh
npm run test:privacy:offline
```

Le laboratoire utilise les vraies migrations applicatives avec Auth et
Storage simulés. Ses sessions et octets privés vivent dans des tables de
fixtures en mémoire. Il exécute réellement les mutations SQL locales :
révocation sessions/clés/invitations, retrait du consentement, effacement des
octets factices, suppression des données possédées puis du compte Auth factice.
Les données des autres comptes restent présentes.

Une demande locale active est obligatoire. Sans `execute: true`, aucune
mutation n’est effectuée. L’exécution exige le texte
`EFFACER UNIQUEMENT LA FIXTURE LOCALE` et trois revues explicites : identité,
conservation et prestataires. Une équipe encore possédée ou un blocage de
conservation refuse l’exécution. La revue des prestataires est une condition,
pas une prétendue suppression distante.

Chaque étape est transactionnelle avec son checkpoint. La reprise saute
les étapes validées, y compris après suppression du profil avant l’étape Auth.
Le résultat n’inclut ni identifiant du compte, ni email, chemin ou secret.
Le journal est temporaire : fermer le laboratoire détruit sa base mémoire.
Cela vérifie la logique de reprise, pas la durabilité d’un journal distant.

Le laboratoire ne prouve pas la révocation des JWT Supabase, l’effacement
d’objets Storage réels, des sauvegardes ou données détenues par un prestataire.
Il ne constitue pas un exécuteur activable sur la production. Cette frontière
est intentionnelle et testée ; aucune suppression distante n’est réalisée.
