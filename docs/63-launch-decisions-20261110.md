# MentionCheck — décisions de pré-lancement du 10 novembre 2026
**Choix approuvés par l'exploitant ; statut : PRÉPARATION TECHNIQUE, AUCUNE OUVERTURE COMMERCIALE.**
Ces choix n'établissent aucune immatriculation, certification, souscription, dépense API ni paramétrage fournisseur.

## Décisions fermes et effets
| Sujet | Décision | Effet en code / exploitation |
| --- | --- | --- |
| Exploitant | Entrepreneur individuel au régime micro-entreprise en France | Dossier EI / micro ; attendre immatriculation réelle, RNE, SIREN/SIRET, identité/adresse, activité déclarée, revue fiscalité et vente B2B/B2C. Ne pas afficher comme déjà créé |
| Supabase Auth (mise à jour 11/11) | Organisation passée à **Pro** (vérifiée directement par connecteur) | Vérifier et activer dans Auth la détection des mots de passe compromis maintenant éligible ; tests reset + Auth avant GO ; ne pas prétendre que l'option est déjà activée |
| Utilisateurs historiques | Deux comptes bénéficiaires de Solo promotionnel | 30 jours gratuits depuis activation effective post-certification ; droits indépendants de Stripe et limités en base par fenêtre, pas de carte ni de renouvellement ; sélection des bénéficiaires par préflight |
| OpenAI | Enveloppe pilote **25 USD par mois maximum visé** | Configurer projet OpenAI dédié avec Monthly spend limit 25 USD et **Enforce a hard limit**, alerte à 20 USD (80%). Le plafond est un contrôle fournisseur à vérifier, et peut être légèrement dépassé ; **aucune dépense autorisée par cette documentation seule** |
| Commercialisation | Publique après certification complète | Pas de bêta commerciale ni de facturation live avant preuves Auth/RGPD, RGPD/CGV, tests paiement, migration cohérente, rollback et identité Stripe validée |

## Promotion Solo historique : règle de sécurité
- Migration versionnée `20261110170000_legacy_solo_promotion.sql` crée `promotional_solo_access` en **table server-only** (RLS activée, aucune policy client, privilèges serveur). Aucune ligne n'est créée par la migration.
- Promotion limitée à **30 jours** au moment de l'octroi. Une promotion expirée accorde automatiquement le quota Gratuit 3/1/3 ; un vrai abonnement Stripe actif a priorité et reste indépendant. `users.plan` ne donne aucun droit payant seul.
- Sans application de cette migration **et** validation métier, le flag `PROMO_SOLO_ENABLED` reste `false` : l'interface n'interroge pas la nouvelle table sur production. Activer `true` seulement après migration et contrôles DB/Worker.
- Une activation doit être décidée au moment de la certification publique pour ne pas consommer la période gratuite avant l'ouverture. Le quota consommé pendant le même mois n'est pas remis à zéro. Aucune carte, abonnement Stripe fictif ou paiement créé.

### Transition pré-GO : zéro perte de droits, zéro jour promotionnel consommé

Le correctif ADDITIF `supabase/migrations/20261111103000_legacy_solo_prelaunch_bridge.sql` étend **la table existante**
`promotional_solo_access`, sans créer de second système d'abonnement ni
changer `users.plan`. `activation_pending=true` (deux comptes historiques
uniquement, identifiés en privé par l'opérateur) préserve le plafond Solo
30/5/20 sans `starts_at` ni `expires_at`. Un abonnement Stripe authentique
reste prioritaire. Les nouveaux comptes sans abonnement ni attribution explicite
restent Gratuit 3/1/3. La table est toujours RLS server-only.

**Verrou absolu :** ne pas effectuer la migration `free_vs_paid_solo_quotas`
ou `legacy_solo_promotion` *séparément* en PROD avant le peuplement du
bridge. Pour les deux comptes actuels, cela provoquerait une rétrogradation
immédiate. Une procédure opérateur doit regrouper les migrations de quotas,
promotion et bridge **et les deux attributions pré-GO dans une même transaction
PostgreSQL**, avec verrouillage des comptes, validation d'identités en privé,
zéro abonnement réel, rollback intégral en cas d'écart et rapprochement de
l'historique des migrations Supabase. **Aucun `supabase db push` séquentiel
en PROD** pour ce chantier. Pas de GO sans sauvegarde logique PRODUCTION
hors site et preuve de restauration isolée. Aucun UUID réel dans Git, logs
ou artifacts. Un script de recette staging ou une sauvegarde schema-only ne
constitue pas cette preuve.

La requête suivante décrit uniquement l'attribution à intégrer **dans la
transaction atomique de première installation en PROD**, après création de
la table et du bridge. **Ne pas l'exécuter séparément.** Refuser
tout état inattendu :

```sql
do $$
declare beneficiary_count integer;
begin
  select count(*) into beneficiary_count
    from public.users
    where created_at < timestamptz '2026-11-11 00:00:00+00';
  if beneficiary_count <> 2 then
    raise exception 'Nombre de beneficiaires historiques inattendu';
  end if;
  if exists (
    select 1 from public.subscriptions s
    join public.users u on u.id=s.user_id
    where u.created_at < timestamptz '2026-11-11 00:00:00+00'
      and s.status in ('active','trialing')
      and s.stripe_subscription_id is not null
  ) then raise exception 'Abonnement Stripe historique : revue requise'; end if;
  insert into public.promotional_solo_access
    (user_id,starts_at,expires_at,reason,activation_pending)
  select id,null,null,'legacy_launch_solo_30d',true
    from public.users
    where created_at < timestamptz '2026-11-11 00:00:00+00'
  on conflict(user_id) do nothing;
  if (select count(*) from public.promotional_solo_access
      where reason='legacy_launch_solo_30d' and activation_pending
        and starts_at is null and expires_at is null) <> 2
  then raise exception 'Pre-GO incomplet : rollback'; end if;
end $$;
```

### GO commercial séparé (script d'opérateur, NON exécuté)

Seulement après toutes les certifications et une décision explicite de GO,
transformer les deux attributions existantes **atomiquement** : les 30 jours
démarrent à ce moment-là, pas au moment de l'installation du bridge.

```sql
begin;
do $$
begin
  perform 1 from public.users where id in (
    select user_id from public.promotional_solo_access
    where reason='legacy_launch_solo_30d' and activation_pending
  ) for update;
  if (select count(*) from public.promotional_solo_access
    where reason='legacy_launch_solo_30d' and activation_pending
      and starts_at is null and expires_at is null) <> 2
  then raise exception 'Deux concessions pre-GO requises'; end if;
  if exists(
    select 1 from public.subscriptions s
    join public.promotional_solo_access p on p.user_id=s.user_id
    where p.reason='legacy_launch_solo_30d'
      and s.stripe_subscription_id is not null and s.status in ('active','trialing')
      and s.current_period_end>now()
  ) then raise exception 'Revoir attribution: paiement actif'; end if;
end $$;
update public.promotional_solo_access
 set activation_pending=false,starts_at=now(),expires_at=now()+interval '30 days'
 where reason='legacy_launch_solo_30d' and activation_pending;
do $$
begin
  if (select count(*) from public.promotional_solo_access
    where reason='legacy_launch_solo_30d' and not activation_pending
      and starts_at=now() and expires_at=now()+interval '30 days') <> 2
  then raise exception 'GO incomplet : rollback'; end if;
end $$;
commit;
```

**Vérifications post-opération :** deux bénéficiaires et pas davantage,
les droits restent 30/5/20 avant et après le GO ; après `expires_at`, le
compte sans Stripe revient à 3/1/3, sans remise à zéro automatique du mois.
Ne pas activer `PROMO_SOLO_ENABLED` ni `BILLING_ENABLED` sur la seule
base d'un test local ; exiger DB/Worker réels et preuves signées.

## Supabase Pro — changement vérifié le 11 novembre 2026

L'organisation `Mentioncheck` (`pbltrqddhyvjpneeddre`) a bien le forfait **Pro** (`tier_pro`), vérifié par le connecteur Supabase. Cette évolution remplace la décision historique d'exploitation sur Free, sans modifier les comptes ni le schéma. L'option de protection des mots de passe compromis est éligible sur Pro, mais son **activation effective et les tests de reset/connexion restent à vérifier** dans les paramètres Auth ; ne pas annoncer une protection native active sans preuve.

Les compensations applicatives déjà préparées sont conservées : mot de passe à l'inscription d'au moins 12 caractères et trois familles sur quatre, confirmation email, limitation des rafales à l'entrée, contrôle d'origine, réponses sans secret. Les réglages Supabase Auth du fournisseur restent nécessaires et la prévention par IP ne remplace pas la détection des secrets divulgués.

**Sauvegardes :** Pro prévoit les sauvegardes PostgreSQL quotidiennes et 7 jours de rétention. **Le forfait Pro et la présence de sauvegardes physiques dans l'interface sont confirmés par la capture du 11/11/2026.** Le snapshot le plus récent visible est daté du **11/11/2026 à 05:19:11 UTC** et porte un bouton `Restore`. Cette preuve ne démontre pas une restauration isolée effectivement réussie. Un backup du fournisseur ne démontre pas à lui seul une restauration dans une base isolée ; la procédure de [copie privée hors site](64-production-private-backup.md) reste disponible. Les binaires Supabase Storage ne sont pas inclus dans les sauvegardes de la base. **Aucune restauration sur Production pour faire un test.**

**Preuve visuelle fournie par l'exploitant le 11/11/2026 à 12:05 (Europe/Paris) :** l'onglet Supabase Production `Database Backups > Scheduled backups` liste des snapshots **PHYSICAL** datés du **11/11/2026 à 05:19:11 UTC** et du **10/11/2026 à 05:19:32 UTC**, ainsi que plusieurs jours antérieurs ; un bouton `Restore` apparaît sur les entrées. Cette preuve confirme la **présence dans le Dashboard** de sauvegardes physiques accessibles à la restauration. Elle ne prouve ni une restauration réussie, ni l'intégrité complète du contenu, ni une protection des octets Storage. Aucune restauration production n'a été lancée.

Le GO reste suspendu aux preuves Auth, RLS, restauration isolée de données PostgreSQL, sauvegarde des objets Storage, RGPD, quotas et décision commerciale.

## Budget IA piloté sans promesse de plafond absolu
- Projet API OpenAI dédié à MentionCheck : limite mensuelle **25 USD**, alerte **20 USD**, **Enforce a hard limit** activé par le propriétaire du projet (preuve de capture non sensible). Surveiller le montant réel de facturation, pas seulement l'estimation `cost_usd` de MentionCheck.
- Aucun appel IA payé en CI, dans les probes, dans les tests unitaires ou dans la préparation du présent lot. Les fonctions audio/embeddings/media automatiques restent désactivées. La sonde `/api/health/ai` valide uniquement des flags et la présence de clé.
- La validation de modèle réel (texte et image avec utilisateurs techniques) intervient **après preuve du budget** et consentement approprié. Une limite projet/organisation peut être dépassée légèrement pendant la synchronisation côté plateforme : bloquer les usages si le seuil est atteint ou en cas d'incident.

## Gate public : liste minimale à cocher
- [ ] Formalités EI micro faites via le guichet unique ; SIREN/SIRET reçu ; revue B2C/B2B, TVA, facturation et mentions légales/CGV/RGPD publiées.
- [ ] Auth Supabase Pro : vérifier et activer la protection des mots de passe compromis ; tests login/reset, MFA/support et anti-rafale, avec preuve des réglages réels.
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

## Recette HTTP Auth staging, sans IA ni facturation
Le workflow `.github/workflows/mentioncheck-launch-staging-auth.yml` est
déclenché uniquement par la branche `feat/mentioncheck-launch-decisions-20261110`.
Il effectue les vérifications de frontière, le build et le déploiement du
**seul** Worker `mentioncheck-staging`, avec IA, billing et promotion
désactivés. Le script `scripts/recette/auth-staging-smoke.mjs` vérifie
login/inscription (contrôle IP Cloudflare + mot de passe faible), Checkout
fermé, utilisateur technique authentifié, page paramètres et accès invité
refusé ; le compte créé est supprimé par ID exact dans `finally`.
Aucun paiement, inscription email sortante, appel IA ni migration de
production n'est déclenché. Un résultat CI vert et un résultat staging
vert sur le même SHA sont nécessaires avant toute revue de fusion.

## Correctif de sécurité découvert par la recette HTTP Auth
La page `/dashboard/settings` ne doit pas demander
`users.stripe_customer_id` via le client Supabase authentifié :
la migration RLS accorde volontairement `SELECT` uniquement sur les
colonnes publiques du profil et ne donne **aucun accès** à l'identifiant
fournisseur Stripe. La présence d'un client de facturation est donc
vérifiée par le serveur seulement lorsque `billingGate` est ouvert,
avec un filtre strict sur `userData.id`, sans transmettre l'ID Stripe.
**Aucun GRANT, RLS ni policy n'est élargi.** Ce correctif traite une
régression de la page Paramètres déjà présente dans la version
Stripe Sandbox et demande une recette Auth staging répétée.

Voir [procédure privée de sauvegarde/restauration Production](64-production-private-backup.md) ; aucune sauvegarde ni preuve de restauration production n'existe encore.

## Recontrôle fournisseur — 11 novembre 2026 (lecture seule)

Sur `main` `527e45aa` et PR #128 `b10999e4`, la CI est SUCCESS ; recette Auth/RLS/RGPD Staging SUCCESS au run #43009439812. **La présence d'un build Preview ne prouve pas le runtime du Worker Production.**

L'advisor sécurité Supabase Production confirme explicitement `auth_leaked_password_protection` **WARN / Disabled** malgré le passage Pro. Cinq RPC `SECURITY DEFINER` accessibles à `authenticated` restent signalées (tests A/B existants, ne pas retirer les permissions sans analyse produit), et six tables RLS sans policy restent fermées par conception. Le connecteur disponible ne permet pas de changer les options de GoTrue ; activation via [Auth settings](https://supabase.com/dashboard/project/zcztvberuihphqklhjsr/auth/providers) et contrôle du Security Advisor requis. Tester inscription, connexion et reset avant GO. Les mots de passe historiques peuvent faire l'objet d'exigences nouvelles : ne pas dégrader la connexion sans recette.

Lecture Stripe **Live sans mutation** : 3 produits et 3 prix existants (Solo **9 EUR**, Pro **19 EUR**, Studio **49 EUR** / mois), un seul endpoint webhook existant `https://mentioncheck.app/api/stripe/webhook` avec 7 types d'événements, portail actif ; **liens CGV et confidentialité du portail vides**. Ne pas dupliquer, ni interpréter le statut `enabled` de l'endpoint comme autorisation d'encaissement. Les flags Cloudflare `BILLING_ENABLED=false` et `STRIPE_LIVE_APPROVED=false` doivent être revérifiés dans les secrets/variables effectifs avant GO. Aucune opération de paiement effectuée.

**Verrou maintenu** : restauration complète PostgreSQL et Storage non attestée, quota Production non migré, utilisateur historique non activé pour 30 jours, protection Auth incomplète, identité légale/CGV non finalisées. Issue #16 ouverte, PR #128 draft, aucune création de clone facturé.
