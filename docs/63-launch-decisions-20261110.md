# MentionCheck — décisions de pré-lancement du 10 novembre 2026
**Choix approuvés par l'exploitant ; statut : PRÉPARATION TECHNIQUE, AUCUNE OUVERTURE COMMERCIALE.**
Ces choix n'établissent aucune immatriculation, certification, souscription, dépense API ni paramétrage fournisseur.

## Décisions fermes et effets
| Sujet | Décision | Effet en code / exploitation |
| --- | --- | --- |
| Exploitant | Entrepreneur individuel au régime micro-entreprise en France | Dossier EI / micro ; attendre immatriculation réelle, RNE, SIREN/SIRET, identité/adresse, activité déclarée, revue fiscalité et vente B2B/B2C. Ne pas afficher comme déjà créé |
| Supabase Auth | Conserver Free, accepter le risque résiduel lié à la détection native des mots de passe compromis | Refus de mots de passe faibles à l'inscription applicative, limitation anti-rafales par IP Cloudflare, politique Auth fournisseur minimale et décision de risque documentée ; ne pas annoncer la protection native active |
| Utilisateurs historiques | Deux comptes bénéficiaires de Solo promotionnel | 30 jours gratuits depuis activation effective post-certification ; droits indépendants de Stripe et limités en base par fenêtre, pas de carte ni de renouvellement ; sélection des bénéficiaires par préflight |
| OpenAI | Enveloppe pilote **25 USD par mois maximum visé** | Configurer projet OpenAI dédié avec Monthly spend limit 25 USD et **Enforce a hard limit**, alerte à 20 USD (80%). Le plafond est un contrôle fournisseur à vérifier, et peut être légèrement dépassé ; **aucune dépense autorisée par cette documentation seule** |
| Commercialisation | Publique après certification complète | Pas de bêta commerciale ni de facturation live avant preuves Auth/RGPD, RGPD/CGV, tests paiement, migration cohérente, rollback et identité Stripe validée |

## Promotion Solo historique : règle de sécurité
- Migration versionnée `20261110170000_legacy_solo_promotion.sql` crée `promotional_solo_access` en **table server-only** (RLS activée, aucune policy client, privilèges serveur). Aucune ligne n'est créée par la migration.
- Promotion limitée à **30 jours** au moment de l'octroi. Une promotion expirée accorde automatiquement le quota Gratuit 3/1/3 ; un vrai abonnement Stripe actif a priorité et reste indépendant. `users.plan` ne donne aucun droit payant seul.
- Sans application de cette migration **et** validation métier, le flag `PROMO_SOLO_ENABLED` reste `false` : l'interface n'interroge pas la nouvelle table sur production. Activer `true` seulement après migration et contrôles DB/Worker.
- Une activation doit être décidée au moment de la certification publique pour ne pas consommer la période gratuite avant l'ouverture. Le quota consommé pendant le même mois n'est pas remis à zéro. Aucune carte, abonnement Stripe fictif ou paiement créé.

### Recette de bascule (script SQL d'opérateur, NON exécuté)
Sauvegarde et test de restauration **avant** la migration, validation du SHA applicatif, absence de transactions Stripe live, vérification explicite des deux bénéficiaires préexistants. Ne pas publier leurs ID dans Git/logs.

```sql
begin;
do $$
declare beneficiary_count integer;
begin
  select count(*) into beneficiary_count from public.users
    where created_at < timestamptz '2026-11-11 00:00:00+00';
  if beneficiary_count <> 2 then
    raise exception 'Nombre de bénéficiaires historiques inattendu : opération annulée';
  end if;
  if exists(select 1 from public.subscriptions s join public.users u on u.id=s.user_id
    where u.created_at < timestamptz '2026-11-11 00:00:00+00'
      and s.status in ('active','trialing') and s.stripe_subscription_id is not null)
    then raise exception 'Abonnement réel déjà présent : revoir la promotion';
  end if;
  insert into public.promotional_solo_access(user_id,starts_at,expires_at,reason)
  select id,now(),now()+interval '30 days','legacy_launch_solo_30d'
    from public.users where created_at < timestamptz '2026-11-11 00:00:00+00'
  on conflict(user_id) do nothing;
  if (select count(*) from public.promotional_solo_access
      where reason='legacy_launch_solo_30d')<>2
    then raise exception 'Promotion partielle : transaction annulée';
  end if;
end $$;
commit;
```

**Gates avant exécution** : exécution uniquement sur la base de production identifiée explicitement, compte opérateur habilité, backup/restore testé, deux comptes historiques identifiés au moyen d'une preuve privée, migrations staging testées, contrôles de quota 30/5/20 puis expiration, interface et RPC coordonnées. On ne déclenche ce script ni en CI ni lors du merge. Si un compte existant ne doit pas bénéficier de la promotion, remplacer la condition globale par la liste approuvée d'IDs côté opérateur **sans les commiter**.

## Supabase Free : acceptation de risque sous conditions
La fonction de protection native `Leaked Password Protection` de Supabase est **Pro+** ; elle reste absente sur Free. Le choix Free n'est **pas** une certification de sécurité ni une acceptation de toutes les attaques par mots de passe compromis.

Compensations préparées : nouvelle inscription application au moins 12 caractères et trois familles sur quatre, confirmation email conservée dans Supabase, limitation Cloudflare par IP hachée avant les appels Auth (30 requêtes/minute/IP partagé login+register), contrôle d'origine et réponses publiques sans secret. Les mots de passe existants restent connectables ; le reset/les méthodes directes Supabase Auth peuvent contourner la validation applicative : configurer **aussi** la politique minimale dans Supabase Auth et tester les réinitialisations. Les limitations Cloudflare ne constituent pas un détecteur de mots de passe divulgués ni une protection totale contre les proxys multiples.

**Décision de risque résiduel** : exploitation temporaire sur Free **acceptée par le propriétaire** ; registre des risques à revoir avant chaque lancement, avec MFA et surveillance des événements de connexion lorsque disponibles. Le lancement public reste bloqué tant que les tests de brute-force, les réglages Auth fournisseur, la limitation et la revue sécurité finale n'ont pas été attestés. En cas d'incident, suspendre les inscriptions et réévaluer l'upgrade.

## Budget IA piloté sans promesse de plafond absolu
- Projet API OpenAI dédié à MentionCheck : limite mensuelle **25 USD**, alerte **20 USD**, **Enforce a hard limit** activé par le propriétaire du projet (preuve de capture non sensible). Surveiller le montant réel de facturation, pas seulement l'estimation `cost_usd` de MentionCheck.
- Aucun appel IA payé en CI, dans les probes, dans les tests unitaires ou dans la préparation du présent lot. Les fonctions audio/embeddings/media automatiques restent désactivées. La sonde `/api/health/ai` valide uniquement des flags et la présence de clé.
- La validation de modèle réel (texte et image avec utilisateurs techniques) intervient **après preuve du budget** et consentement approprié. Une limite projet/organisation peut être dépassée légèrement pendant la synchronisation côté plateforme : bloquer les usages si le seuil est atteint ou en cas d'incident.

## Gate public : liste minimale à cocher
- [ ] Formalités EI micro faites via le guichet unique ; SIREN/SIRET reçu ; revue B2C/B2B, TVA, facturation et mentions légales/CGV/RGPD publiées.
- [ ] Auth Supabase Free : paramètres du fournisseur vérifiés, test de reset, MFA/support, preuve d'anti-rafale et acceptation du risque résiduel signée par l'opérateur.
- [ ] Preuves E2E authentifiées staging et cible finale, RLS, contrôle des RPC/permissions, RGPD export et suppression, capacité et quotas.
- [ ] Backup/restauration PostgreSQL adapté, rollback de **deux versions différentes**, SHA Cloudflare + CI `main` verts.
- [ ] Migration promotion et quotas appliquée de manière coordonnée, exactement deux bénéficiaires activés pour 30 jours **au lancement**, affichage/quotas revérifiés.
- [ ] Projet API OpenAI à 25 USD + hard limit et alerte à 20 USD vérifiés ; un test réel autorisé, suivi des dépenses et coupe-circuit.
- [ ] Stripe Live : identité validée, trois prix live, webhook signé, portail, cartes tests/SCA/3DS, cas d'échec et de résiliation ; revue des taxes et des contrats.
- [ ] Décision GO commerciale distincte et explicite ; `BILLING_ENABLED=false` jusqu'alors.

## Références
- [Guichet unique micro-entreprise](https://entreprendre.service-public.gouv.fr/vosdroits/F36746)
- [Supabase Password Security](https://supabase.com/docs/guides/auth/password-security)
- [OpenAI API project limits](https://help.openai.com/en/articles/9186755-managing-projects-in-the-api-platform)
- [Dossier de lancement](61-dossier-lancement-commercial-2026.md)
- [Portes de livraison](17-ci-release-gates.md)


## Preuve technique : staging Supabase, 10 novembre 2026
La migration `legacy_solo_promotion_30d` a été **exécutée** sur le projet de
**staging exclusivement** `ukvgnkxgzyhswgpnvyzz` (version d'historique
`20261110155234`). Contrôle SQL en lecture seule après migration :
`table_present=true`, `rls_enabled=true`, `anon_can_read=false`,
`authenticated_can_read=false`, `service_can_read=true`,
`promotions_issued=0`, `quota_uses_promotion=true`.

Cette preuve ne vaut ni test unitaire local vert, ni validation E2E
authentifiée, ni migration de production. La base de production
`zcztvberuihphqklhjsr` **n'a pas été modifiée** pour ce lot.
