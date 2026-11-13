# Reprise MentionCheck — 6 novembre 2026

## Reprise 13 novembre — lancement encore bloqué

Voir l'addendum courant du [PV existant](docs/receipts/2026-11-10-final-internal-certification.md). Studio/RGPD #43331051325 SUCCESS confirmé, queue staging conservée. Production 19 migrations contre staging 25, deux Solo protégés sans mutation. Correction configuration IA fermée préparée dans #128 ; YouTube seul et tous flags OAuth production fermés dans #132. HTTP accueil 200, mais sonde IA runtime `configured` : fermeture non déployée/attestée. Accès Cloudflare authentifié absent, compte test avec chaîne absent. Aucun nouveau ticket ni migration ni sauvegarde.


## État consolidé — 12 novembre 2026 (anti-doublons, remplace les snapshots historiques)

**Références canoniques : [issue #16](https://github.com/totorina47501-wq/Project3/issues/16), [PR #128](https://github.com/totorina47501-wq/Project3/pull/128), [13/13 SHA-256 des archives](https://github.com/totorina47501-wq/Project3/pull/128#issuecomment-6805923183).** Branche de travail `codex/codex-certification-six-chantiers`, dernière CI intégrale contrôlée sur `d1da139b` avant cet addendum documentaire.

- **P0-A — rollback interversions Cloudflare : PASS sur STAGING.** [Run #42981396379](https://github.com/totorina47501-wq/Project3/actions/runs/42981396379) : deux SHA applicatifs différents, retour B→A, puis retour au déploiement initial, contrôles HTTP et secrets. Ne pas rejouer le test déjà certifié.
- **P0-B — PRA :** PostgreSQL/Auth restaurés sur clone Supabase isolé `sbquwigqlzfglukxdgau`, 13/13 agrégats SQL concordants. **Storage 13/13 objets copiés, 832 860 octets, manifestes concordants et archives Production/PRA déjà comparées SHA-256 : 13/13 identiques (5 originaux + 8 dérivés)**. Ne pas refaire de copie ni de test SHA sur les ZIP. **Seule la provenance fournisseur indépendante des octets réels Storage n'est pas attestée par ces archives** ; PRA global PARTIAL, sans GO commercial. Voir [PRA](docs/64-production-private-backup.md).
- **P0-C — quotas : migrations Gratuit/Solo, promotion et bridge pré-GO déjà installées en STAGING, pas en Production.** Production : 2 profils historiques Solo, 0 abonnement Stripe actif, table promotion absente. La fenêtre gratuite de 30 jours **n'a pas commencé**. Le correctif UI pré-GO et le garde de branche RGPD sont au commit `1850998` ; les deux fils Codex sont résolus. Ne créer ni migration ni moteur de quotas supplémentaire ; aucune bascule Production avant GO séparé et vérifié.
- **P1-D/E/F — preuves staging ciblées existantes** : Auth/RLS/RPC et cycle d'effacement de **fixture synthétique** [#42982377973](https://github.com/totorina47501-wq/Project3/actions/runs/42982377973), API Studio [#42982215401](https://github.com/totorina47501-wq/Project3/actions/runs/42982215401). Ne pas les confondre avec certification d'un effacement utilisateur réel, protection native Auth des mots de passe compromis, ni runtime Production.
- **CI réconciliée sur `d1da139b` :** [#43273242174](https://github.com/totorina47501-wq/Project3/actions/runs/43273242174) **completed/success** avec jobs qualité + image média, [Auth staging #43273230718](https://github.com/totorina47501-wq/Project3/actions/runs/43273230718) et [Studio + RGPD staging #43273230690](https://github.com/totorina47501-wq/Project3/actions/runs/43273230690) **completed/success**. Ces tests ne certifient pas le runtime Production, le juridique ni la sécurité chez les prestataires. Recontrôler la CI du SHA final après cet addendum.

**Reste NO GO commercial** : Auth HIBP/configuration fournisseur et vérifications, cycle RGPD pour vrais clients/sous-traitants, migration Solo atomique en Production seulement après autorisation, sécurité/rétention du clone PRA, identité légale/CGV, Stripe Live, SHA du runtime Production et statut final CI. **PR #128 DRAFT, #16 OPEN ; aucune modification Production, aucun Stripe Live ni coût IA payé déclenché.** Les passages datés ci-dessous sont des archives et ne remplacent pas cette synthèse.

## Historique — état antérieur au test binaire Storage (non courant)

**Source de vérité : issue #16 et PR #128 existantes (HEAD de base de preuve : `24aa6f7151571cab13489ac26cc258fcf8a3c241`).** Le clone PRA `sbquwigqlzfglukxdgau` est `ACTIVE_HEALTHY` ; **restauration PostgreSQL/Auth PASS** (13/13 sections de données/cataloque SQL concordantes), mais **aucune restauration des 13 octets-objets Storage** (**832 860 octets de métadonnées**, non des octets restaurés). **P0-B PARTIAL / Storage BLOCKED.** Ne pas relancer de clone payant ou de prototypes Docker/Cloudflare, ne pas confondre Storage SQL avec fichiers. Pour l'exercice Storage, utiliser **S3 privé Supabase sur un hôte de confiance** avec SHA-256 du contenu et contrôle de suppression. Ce mécanisme nécessite des secrets/runtime non fournis au connecteur. Voir [docs/64](docs/64-production-private-backup.md).

CI/recettes SHA avant cette actualisation documentaire : [CI #43050141101](https://github.com/totorina47501-wq/Project3/actions/runs/43050141101), [Auth #43050125348](https://github.com/totorina47501-wq/Project3/actions/runs/43050125348), [Studio #43050125205](https://github.com/totorina47501-wq/Project3/actions/runs/43050125205) = **SUCCESS**. Préserver les 2 promotions Solo historiques, facturation Stripe Live OFF, Production sans mutation, PR draft, #16 ouverte. Les passages ci-dessous représentent **des snapshots antérieurs** et ne doivent pas contredire cette entrée.


## Point de reprise vérifié — 11 novembre 2026 (audit Task Force, sans changement applicatif)

- GitHub `main` : `527e45aa98a9267afb4ea78896dbd51495411e6d`, jobs CI `quality` et média SUCCESS ; PR #128 maintenue **draft**, SHA d'audit `b10999e4af8d776e44f8af89cade105a91f69ddf`, [CI #43009448934](https://github.com/totorina47501-wq/Project3/actions/runs/43009448934) SUCCESS et [Auth staging #43009439812](https://github.com/totorina47501-wq/Project3/actions/runs/43009439812) SUCCESS. Preview Cloudflare SUCCESS uniquement ; SHA servi par Worker Production non attesté.
- Production SQL (lecture seule) : 2 utilisateurs Auth, 2 profils, 2 lignes de quotas, 0 abonnement Stripe actif, 13 objets Storage / 3 buckets, table promotion Solo absente ; Staging : 0 utilisateur/profil/objet et table promotion présente. Migrations quotas/promotion/bridge uniquement en staging. Aucun déploiement/migration de production.
- Supabase Pro : snapshots physiques attestés par capture opérateur du 11/11 à 05:19:11 UTC et du 10/11 à 05:19:32 UTC ; connecteur sans liste des snapshots, aucune restauration isolée effectuée. Devis indicatif du connecteur pour **un projet supplémentaire : 10 USD/mois**, frais réels de clonage à confirmer dans le Dashboard ; **aucun projet créé**. Storage nécessite son export/retest distinct et chiffré. Voir `docs/64-production-private-backup.md`.
- Supabase Security Advisor Production : protection contre les mots de passe compromis **DÉSACTIVÉE**, 5 avertissements RPC `SECURITY DEFINER` accessibles aux comptes authentifiés et 6 tables RLS sans policy (tables fermées à contrôler). Activer/configurer Auth uniquement après vérification opérateur, puis tester inscription/login/reset sur Staging et contrôler Production. Aucun changement de configuration Auth effectué ici.
- Stripe Live lecture seule : **3 produits / 3 prix mensuels existants** (Solo 9 EUR, Pro 19 EUR, Studio 49 EUR), **1 webhook** existant à `https://mentioncheck.app/api/stripe/webhook` (enabled, 7 types d'événements), portail actif mais liens CGV/confidentialité absents. Ne pas créer de doublons ; aucune vente, facturation ou activation Live effectuée ; flags Worker de production à vérifier séparément.
- **NO GO commercial** jusqu'aux restaurations réelles PostgreSQL + Storage, protection Auth, migration atomique des quotas pré-GO, dossiers juridiques/Stripe et attestation du runtime. Preuves centralisées dans [issue #16](https://github.com/totorina47501-wq/Project3/issues/16). Aucun appel IA API payant.


## Auto-intégration des PR Copilot à faible risque — 9 novembre 2026

- **Motif** : les PR #106 et #109 ont nécessité un passage manuel de brouillon à prêt/fusion malgré Copilot terminé et CI verte. Le workflow existant limitait volontairement l'auto-merge aux seuls tests/docs ; son réveil dépendait surtout de la CI, alors que le run cloud agent peut finir *après* elle.
- **Correctif proposé** : le workflow de récupération sur la branche fiable `main` écoute aussi la fin de la session Copilot et les événements de PR `ready_for_review`, `edited`, `synchronize`. Aucun checkout du code de PR avec un token d'écriture. Rattrapage planifié conservé comme secours GitHub best-effort.
- **Conditions cumulatives** : PR de l'acteur `Copilot` sur branche `copilot/` du même dépôt vers `main`; une seule issue ouverte explicitement `agent:approved`, réellement affectée à Copilot ; aucune étiquette sensible ; fichiers uniquement tests, docs autorisés, ou petites surfaces UI explicitement listées ; aucune suppression/renommage, limites de lignes, patch UI disponible et absence de nouveaux appels réseau/accès données/données sensibles dans les lignes ajoutées ; dernière CI au SHA exact `quality` + runner média SUCCESS ; dernière session agent terminée SUCCESS après le commit ; relecture de l'état et merge SHA verrouillé.
- **Hors auto-merge** : API, Auth, RLS/SQL, billing, RGPD, sécurité, scripts et workflows, configuration, dépôts externes, déploiement, fichiers volumineux ou diff indécidable, PR Codex #94 / issue #16. Un avertissement GitHub est émis ; ne jamais contourner une protection GitHub.
- **Post-fusion** : CI de `main` explicitement déclenchée, puis dispatcher relancé après CI `main` verte. Ce mécanisme n'autorise **ni ouverture commerciale ni activation de prestataire payant**.
- **Portée de la preuve** : le test statique de la politique et la CI du workflow sur sa PR sont nécessaires. Le cycle complet pour une **nouvelle PR Copilot admissible** (fin agent → merge robot → CI `main` → clôture issue → prochain dispatch) reste à observer avant d'annoncer « full auto démontré ». Ne pas simuler une fusion ni consommer de crédits IA pour fabriquer une mission de test.

## Réveil événementiel des missions Copilot — 9 novembre 2026

- À 12h48 (Europe/Paris), aucun run GitHub `schedule` à 12h30 n'était observable, alors que l'issue [#105](https://github.com/totorina47501-wq/Project3/issues/105) était `agent:approved` et sans affectation. Le run précédent `workflow_dispatch` était antérieur à la création de l'issue. Cause externe exacte du saut de planification non prouvée : un cron GitHub Actions est best-effort.
- Relance du **job existant** [#42606576564, tentative 2](https://github.com/totorina47501-wq/Project3/actions/runs/42606576564), `DRY_RUN=false`, statut `success` : affectation `Copilot` effectivement persistée sur #105 et ouverture de la [PR Copilot #106](https://github.com/totorina47501-wq/Project3/pull/106). Le code de l'application n'a pas été touché.
- Le dispatcher écoute désormais aussi les événements `issues.opened` et `issues.labeled`, en plus de `closed`, pour démarrer sur la création/validation sans attendre `:00` ou `:30`. Les garde-fous de la file (`agent:approved`, exclusion Codex, plafond de 2, anti-doublon et vérification post-affectation) restent inchangés. Le cron demeure un filet de sécurité, non une garantie de ponctualité.
- Preuve à contrôler sur la prochaine **nouvelle** issue approuvée : run d'événement `issues` sur `main`, affectation persistée, puis PR agent. Cette modification ne prouve pas à elle seule ce scénario.

## Point main et frontière Cloudflare — 9 novembre 2026 (mise à jour)

- La **PR #99 est fusionnée** sur `main` : SHA `87f6244446600dddbe17642fc37308c6d8d62256`, [CI principale #366 verte](https://github.com/totorina47501-wq/Project3/actions/runs/42543040484) **à ne pas confondre avec le run de certification staging**. La certification Preview staging est attestée séparément dans le run [#42540861095](https://github.com/totorina47501-wq/Project3/actions/runs/42540861095) ; consulter l'historique détaillé pour les étapes antérieures.
- Sur ce lot, la CI PR protège systématiquement les frontières `wrangler.staging.jsonc` et `wrangler.jsonc → previews`. Tests synthétiques de refus des références production, des services payants, des namespaces partagés et de toute clé `service_role`. Les validations sont **statiques et hors réseau** : elles ne déclenchent aucun déploiement, n'attestent ni la configuration réelle de Cloudflare ni un build production distant.
- L'issue [#16](https://github.com/totorina47501-wq/Project3/issues/16) reste ouverte : preuve finale production, politique Supabase Auth « leaked password protection », éventuel rollback inter-version sont à distinguer des preuves staging. Ne pas déclarer le lancement commercial prêt sur une CI verte.


## Certification Cloudflare Preview staging — PASS le 9 novembre 2026

- **Preuve réelle finale :** [GitHub Actions #42540861095](https://github.com/totorina47501-wq/Project3/actions/runs/42540861095), SUCCESS, SHA `0632cfded8c4f5958b3ffb9eb4655933736ab08b` de PR draft #99. Le token Cloudflare mis à jour est opérationnel sur **mentioncheck-staging uniquement**.
- Suite complète : vérification préalable d'inventaire vide, OpenNext + `wrangler deploy --dry-run`, activation temporaire de Preview URLs, création de `qa-cert-0632cfde`, récupération de l'ID par l'API, GET `/login` **200**, accès invité à l'API privée refusé (**401/403**), désactivation des URLs, DELETE de **cette Preview par ID**, contrôle final **zéro orpheline**, et `previews_enabled=false` restauré.
- La Preview temporaire **n'existe plus**. Le nouveau token a passé le précontrôle permission DELETE sur UUID inexistant ([run #42537592547](https://github.com/totorina47501-wq/Project3/actions/runs/42537592547), nouvelle tentative). Les refus 403 et 404 des runs antérieurs sont historiques et **résolus pour la Preview de staging**.
- **Ce qui reste** : build Cloudflare de **production** corrigé seulement dans la PR non fusionnée (aucun redéploiement effectué), politique Auth mots de passe compromis indisponible nativement sur Supabase Free, éventuel rollback entre deux versions de code différentes si requis par l'audit. Conserver issue #16 ouverte avec `release:evidence-required`.
- Aucun service externe additionnel, aucune facture OpenAI, aucun changement de production. Le nouveau jeton Admin individuel staging peut être remplacé/révoqué après recette pour réduire les privilèges.

## Statut des Previews Cloudflare — 9 novembre 2026

- **Preview QA supprimée**, inventaire vérifié : `STAGING_PREVIEW_INVENTORY_OK total=0 qa=0` ([run #42534677039](https://github.com/totorina47501-wq/Project3/actions/runs/42534677039)).
- **Activation et désactivation par API réussies**, réglage initial `previews_enabled=false` restauré ([run #42537467003](https://github.com/totorina47501-wq/Project3/actions/runs/42537467003)).
- **Droit de suppression manquant** : DELETE d'un UUID aléatoire inexistant, inventaire initial vide, refus HTTP 403 ([run #42537592547](https://github.com/totorina47501-wq/Project3/actions/runs/42537592547)). Aucune Preview créée.
- **URLs versionnées non validées** : metadata sans URL ; réponses HTTP 404 malgré activation temporaire, réglage rétabli et inventaire vide ([run #42537924478](https://github.com/totorina47501-wq/Project3/actions/runs/42537924478)).
- **À faire** : limiter à `mentioncheck-staging` un jeton Cloudflare autorisé à supprimer les Previews, puis exécuter un cycle création/smoke/suppression. Ne pas étendre les autorisations au Worker production. PR #99 draft, issue #16 ouverte.
## Validation Cloudflare Preview — 9 novembre 2026 (historique, Preview supprimée depuis)

Le correctif `previews` de la PR #99 a passé Next.js, OpenNext et `wrangler deploy --dry-run` sur le Worker staging. La Preview temporaire `qa-cert-11cba5d3` a été créée mais sans URL car `previews_enabled=false`. Le nettoyage ciblé a échoué en **HTTP 403**, donc cette Preview QA est encore présente (sans URL publique). Un garde-fou empêche de nouvelles créations tant que les URLs staging restent désactivées. **À traiter via Cloudflare staging uniquement** : supprimer la Preview par son nom/ID, puis choisir si les URLs de preview doivent être activées. Production toujours inchangée ; garder la PR #99 draft et l'issue #16 ouverte. [Preuves](docs/receipts/2026-11-09-cloudflare-preview-diagnostic.md).


## Restauration du schéma staging hébergé — VALIDÉE le 8 novembre 2026

[GitHub #42528880867](https://github.com/totorina47501-wq/Project3/actions/runs/42528880867) **SUCCESS** : vraie connexion Postgres Session pooler du projet staging, dump **schema-only** de `public`, `privacy_internal`, `studio_private`, restauration sur Supabase local Docker jetable, empreintes de 9 catégories de catalogues correspondantes (27 tables, 25 policies, 30 fonctions publiques, 3 privées, 156 contraintes). Une seule contrainte de scopes API subit une normalisation textuelle ciblée des parenthèses/casts, sans assouplissement des autres 155. Aucun contenu utilisateur ni secret exporté, aucun changement sur production. Détails : [procès-verbal actualisé](docs/receipts/2026-11-08-staging-certification.md). Le build Cloudflare production et la politique Auth restent non certifiés ; issue #16 maintenue ouverte, PR #99 draft.


## Rollback staging réellement vérifié — 8 novembre 2026

Le [run #42522596101](https://github.com/totorina47501-wq/Project3/actions/runs/42522596101) est **SUCCESS** : version staging identique créée avec la même clé, vérification des deux bindings secrets, retour effectif au déploiement sain par `wrangler rollback`, smoke HTTP final OK. **Ce n'est pas un rollback de code différent.** La production n'a pas été modifiée. Les vraies restauration du schéma staging, validation du build Cloudflare et décision sur Auth compromises restent bloquantes. Voir le [procès-verbal](docs/receipts/2026-11-08-staging-certification.md).


## Diagnostic de build Cloudflare et réserve Auth — 8 novembre 2026

Le build Workers rouge a été expliqué par ses logs : `npx wrangler preview` requiert un bloc `previews` absent de `wrangler.jsonc`. La PR draft #99 propose un bloc strictement isolé, **non déployé sur `main`**, validé par un garde-fou statique. Organisation Supabase vérifiée Free ; protection native anti-mots de passe compromis disponible seulement sur Pro. Rollback staging non exécuté (versions historiques potentiellement sans tous les secrets). Voir le [procès-verbal actualisé](docs/receipts/2026-11-08-staging-certification.md). Issue #16 reste ouverte.


## Point opérationnel — certification staging du 8 novembre 2026

**Lire en premier** [le procès-verbal du 8 novembre](docs/receipts/2026-11-08-staging-certification.md). Le Worker staging est réellement publié, Auth A/B et 9 tests navigateur sur staging sont PASS (run #42519296878), et les données factices ont été intégralement nettoyées. La vraie restauration de schéma hébergé, le rollback distant et la décision Auth restent non exécutés. Le dernier check Cloudflare Workers Builds production associé au SHA est en échec, même si la page de connexion répond. Issue #16 ouverte ; production inchangée.


## Worker staging Cloudflare — préparation du 8 novembre 2026

Fichiers `wrangler.staging.jsonc` et `.github/workflows/mentioncheck-staging-cloudflare.yml` : Worker isolé `mentioncheck-staging`, traitements payants désactivés. Déploiement **non encore prouvé** : accès Cloudflare et secrets staging requis avant `publish`. Lire la section dédiée dans `docs/52-recette-isolee-cout-minimal.md`. Production inchangée.

## Staging Supabase créé — 7 novembre 2026

Projet gratuit isolé : `MentionCheck-Staging` / `ukvgnkxgzyhswgpnvyzz` ; production : `zcztvberuihphqklhjsr`. **18 migrations appliquées sur staging**, 27 tables et RLS conformes aux définitions de production ; test SQL A/B simulé passé avec rollback et **zéro donnée conservée**. Lire [`docs/52-recette-isolee-cout-minimal.md`](docs/52-recette-isolee-cout-minimal.md) avant toute recette. Les tests Auth réels, Worker staging, backup/restore du schéma et rollback restent non exécutés. Ne pas utiliser de clés de production en staging, ne pas clôturer #16.

## Recette isolée / issue #16 — préparation du 7 novembre 2026

Voir [docs/52-recette-isolee-cout-minimal.md](docs/52-recette-isolee-cout-minimal.md) et `scripts/recette/isolated-postgres-restore.sh` pour le laboratoire sans accès production. Ce labo synthétique ne remplace pas les preuves Auth/RLS hébergées, l'isolation staging/prod et la restauration d'un véritable schéma. Aucun staging facturé ni changement Supabase production autorisé par ce lot. L'issue #16 porte `release:evidence-required` ; ne pas la fermer sur une seule CI verte.

## Audio et exploitation — lot suivant du 6 novembre

Lire [docs/48-audio-and-commercial-preflight.md](docs/48-audio-and-commercial-preflight.md). L’audio est explicitement activé dans Wrangler ; le choix du créateur et les autres interrupteurs restent obligatoires. Le contrôle signale les transcriptions vides ou tronquées et comptabilise les réponses audio mal formées.

Un diagnostic commercial local réutilise le contrôle existant : `node scripts/commercial/check.mjs`. Modèle vierge : `docs/commercial-dossier.template.json` ; ne pas inventer les informations de l’exploitant. Les valeurs et secrets ne sont jamais reproduits dans le rapport. Aucun paiement, email ou OAuth activé. Le lot laisse `package.json` et les fichiers de la PR Copilot #34 intacts.

Audio réellement validé sur `a1c8385` : une transcription gpt-transcribe, trois frames et la légende, mode complet, doublon idempotent, estimation totale 0,00568 USD. Signal technique sans paroles : ne pas confondre avec une mesure de précision sur voix naturelle. Compte de recette rebanni, zéro session active. [Preuve audio](docs/receipts/2026-11-06-audio.json). Ne pas répéter cette recette payante. Le commit suivant ne modifie que la preuve et les délais réseau de l’installation FFmpeg en CI.

## Reprise prioritaire — lot intégré du 6 novembre

Lire [docs/47-integrated-delivery.md](docs/47-integrated-delivery.md) avant les bilans historiques ci-dessous. Le lot part de `abcdb79` et conserve les ajouts Copilot ; la PR liens Markdown reste indépendante. Registre : 24 domaines, 36 routes, 18 migrations sources. Trois migrations additives sont appliquées, versions distantes recensées dans le bilan. Aucun nouveau texte juridique importé ni activation Stripe.

La route `/api/media/jobs/[id]/analyze` analyse explicitement les sorties privées déjà préparées ; ne pas la recréer. Historique idempotent, quotas transactionnels, preuves séparées et export RGPD sont raccordés. Vérifier `media_ai_runs` et les coûts liés avant de répéter une recette réelle. La transcription exige le choix utilisateur et OPENAI_AUDIO_ENABLED=true ; elle reste désactivée par défaut.

Validation locale : 337 unités, 90 médias, 25 corpus, 11 suites SQL, Playwright 24 réussis/1 ignoré, TypeScript/lint/build/bundle/dry-run réussis. GitHub CI et déploiement se contrôlent sur le SHA contenant ce bilan ; ne pas confondre ces niveaux de preuve.

Recette réelle supplémentaire sur `ccb441d` : carrousel 2/2 et vidéo 3/3 frames, légendes analysées, mode complet, historique et doublons idempotents. Sept appels GPT-4o journalisés, coût estimé 0,00992 USD ; audio non demandé. Compte technique à nouveau désactivé et aucune session active. Voir [relevé minimisé](docs/receipts/2026-11-06-prepared-media-ai.json). Ne pas répéter ces appels pour reproduire le bilan. Le correctif suivant ne touche que les fixtures de tests et la documentation ; la logique applicative est identique.

## Point de départ

- Dépôt : `totorina47501-wq/Project3` ; travailler sur `main`.
- Dernier commit avec recette OpenAI réelle : `0d8aec2822ef7d50fed4028f7af66ba3421bfc45`.
- Les commits tarifs/SEO jusqu’à `7f08d39` sont intégrés. Le correctif de fiabilité suivant est décrit dans [docs/39-technical-reliability.md](docs/39-technical-reliability.md).
- Les résultats OpenAI réels ci-dessous restent attachés à `0d8aec2` ; aucun appel payant supplémentaire pour ce correctif.
- Application : https://mentioncheck.toto-rina47501.workers.dev.
- Stack réelle : Next.js **15.5.28**, React 19, TypeScript strict, Supabase,
  OpenNext et Cloudflare Workers. Ne pas rétrograder vers Next.js 14 sur la
  seule base du cahier des charges initial.

## Lire avant toute modification

1. [Registre anti-doublons](docs/work-registry.json) : 21 domaines,
   35 routes et 15 fichiers de migration référencés au moment de la livraison.
2. [Bilan réel OpenAI](docs/37-real-openai-validation.md) et son
   [relevé minimisé](docs/receipts/2026-11-05-openai.json).
3. [Livraison interne précédente](docs/36-internal-delivery-validation.md),
   puis le [correctif technique](docs/39-technical-reliability.md) et le document du domaine à modifier indiqué par le registre.

Le registre décrit le code ; le bilan daté décrit les validations distantes.
Ne pas considérer une ancienne phrase « à valider » comme une tâche manquante
sans comparer avec ces preuves plus récentes.

## Déjà réalisé — éviter les doublons

- Collaborations, archives, PDF, contrôles de propriété et registre horodaté.
- Studio : espaces, rôles, invitations et clés API, avec tests locaux SQL/HTTP.
- RGPD : préférences, consentements, export paginé et demandes d’effacement ;
  tests d’effacement uniquement sur base locale jetable.
- Pipeline vidéo/carrousel, extraction FFmpeg/Sharp, file SQL, reprise et tests médias.
  Transport Storage et exécution Cloudflare Containers désormais opérationnels,
  validés réellement sur carrousel et vidéo. Voir [docs/41-cloudflare-containers.md](docs/41-cloudflare-containers.md).
- Mia : corpus juridique déjà indexé **5/5**, recherche hybride, historique,
  citations et coûts par compte. Ne pas relancer l’indexation initiale.
- GPT-4o texte, réécriture et Vision validés réellement en mode complet.
  Embedding Mia réel et réponse sourcée validés ; absence de citation hors corpus.
- Prix Solo pris en charge dans le parcours Stripe de test ; aucune activation live.

## État distant à préserver

Projet Supabase : `zcztvberuihphqklhjsr`.

| Migration source | Nom distant | Version distante appliquée |
|---|---|---|
| `20261104225500_media_processing_queue.sql` | `media_processing_queue` | `20261105000826` |
| `20261105003500_ai_usage_ownership.sql` | `ai_usage_ownership` | `20261105003303` |
| `20261105082000_quota_reservation_period.sql` | `quota_reservation_period` | `20261105081854` |
| `20261105084500_private_media_outputs.sql` | `private_media_outputs` | `20261105083555` |

La réservation renvoie sa période UTC ; chaque remboursement réutilise cette période.
Les anciennes signatures sont conservées pour le déploiement progressif.

Les noms de version locaux et distants diffèrent : comparer les contenus et
les empreintes du bilan avant d’appliquer une migration. La migration
d’invalidation du corpus est également déjà appliquée, version `20261104212312`.
La file a été créée sans activer son runner ni les traitements distants.

La clé OpenAI existante est dans le Worker. Ne pas demander une nouvelle clé,
la faire tourner ou chercher à l’extraire pour refaire une validation déjà passée.
Le compte technique de recette est désactivé, ses sessions sont expirées.
Les secrets et scripts temporaires ne sont pas versionnés et leur présence
dans un autre environnement n’est pas garantie.

## Contraintes de reprise

- Comparer GitHub et le travail local avant d’éditer ; préserver les changements
  concurrents. L’autorisation utilisateur actuelle vise directement `main`,
  sans nouvelle branche, PR ou fusion supplémentaire.
- Ne déclencher ni suppression/purge en production, paiement réel ou email réel.
- Des appels OpenAI réels ont été autorisés et effectués pour cette recette.
  Le lot de reprise n’en nécessite aucun ; ne pas relancer des appels payants
  uniquement pour reproduire les résultats du bilan.
- Ne pas activer le runner distant ou les autres intégrations par simple
  application des migrations. Les tests CI gardent les fournisseurs désactivés.
- Ne jamais publier cookies, mots de passe, clés ou URL signées.

## Prochain chantier utile

1. Inspecter `workers/media-jobs`, `workers/video`, `workers/carousel` et
   [le pipeline média local](docs/35-local-media-pipeline.md).
2. Le runner Cloudflare existe déjà : ne pas recréer un hébergement. Lire le
   [bilan réel](docs/41-cloudflare-containers.md) et surveiller les limites de coût
   et la file. Les médias synthétiques et leurs preuves sont conservés.
3. Préparation média de bout en bout validée sur Cloudflare ; analyse IA des
   frames et transcription audio restent à développer/valider séparément.
4. Traiter ensuite OAuth, email et paiement selon l’autorisation et les accès
   disponibles, puis les coordonnées légales et accords prestataires.

## Commandes de reprise et de vérification

Depuis le dépôt ; adapter les permissions réseau à l’environnement :

```bash
git status --short
git fetch origin main
git log -5 --oneline FETCH_HEAD
git diff HEAD FETCH_HEAD --stat
npm run work:check
npm run work:find -- media
```

Ne pas réinitialiser le répertoire de travail pour se synchroniser. Si nécessaire,
intégrer les changements distants en préservant les modifications locales.
Utiliser la version Node de `.nvmrc` et le lockfile existant.

```bash
npm ci --ignore-scripts
npm run typecheck
npm run lint
npm test
npm run test:video:offline
npm run test:carousel:offline
npm run test:media-jobs:offline
npm run test:sql-harness
npm run test:sql:offline
npm run test:privacy:offline
npm run test:training:offline
npm run test:fixtures
# Si Chromium est fourni par le système : PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e
npm run test:e2e
OPENAI_PAUSED=true BILLING_ENABLED=false NEXT_TELEMETRY_DISABLED=1 npm run build
OPENAI_PAUSED=true BILLING_ENABLED=false NEXT_TELEMETRY_DISABLED=1 npm run test:cloudflare:bundle
```

Les tests SQL et d’effacement ci-dessus utilisent un environnement local jetable :
ne jamais envoyer leurs fixtures au projet Supabase de production. FFmpeg,
FFprobe et Chromium sont nécessaires aux tests concernés. Exécuter Playwright
avant le build, sans écritures concurrentes dans `.next`.

Résultat historique de la recette OpenAI (`0d8aec2`) : **249 unitaires**, **60 médias**, **6 suites SQL**,
**6 fixtures**, **7 RGPD**, **22 préparation IA**, **21 Playwright réussis et
1 ignoré** ; TypeScript, lint, build, bundle, CI et déploiements Cloudflare réussis.
Ces chiffres sont attachés au commit applicatif ci-dessus, pas à un futur travail.

Le correctif suivant couvre la journalisation embedding, les périodes de quota et le
CTA Solo de test. Il conserve les tarifs, le SEO et les contraintes de production.
Consulter son bilan dans [docs/39-technical-reliability.md](docs/39-technical-reliability.md).

Le raccordement Storage est livré séparément du démarrage distant. Aucun appel IA
ni transcription n’est ajouté au runner. Son guide est [docs/40-remote-media-runner.md](docs/40-remote-media-runner.md).

La CI comporte désormais `media-container` : construction de l’image et recette
Sharp/FFmpeg sans réseau ni secrets. Vérifier son résultat sur le dernier SHA ;
elle ne remplace pas l’hébergement et la recette Storage réelle.

## Passage sur Cloudflare Containers autorisé

L’utilisateur confirme son forfait Cloudflare payé et demande de l’utiliser.
Le lot suivant réutilise Workers Builds et les secrets du Worker existant ;
il n’exige pas de nouvel hôte ni de copie de clé hors du compte. Lire
[docs/41-cloudflare-containers.md](docs/41-cloudflare-containers.md) avant de
modifier le point d’entrée ou de chercher à créer un autre serveur.

Le wrapper `workers/cloudflare-entry.mjs` conserve OpenNext et exporte le
Durable Object `MediaRunner`. Les flags média de `wrangler.jsonc` sont activés
intentionnellement pour ce déploiement ; les autres secrets restent préservés.
Le coupe-circuit runtime est `MEDIA_RUNNER_PAUSED=true`. Aucun appel IA ajouté.
Le statut réel doit être contrôlé sur le dernier SHA et via la route média
avec un compte authentifié ; un build réussi seul ne prouve pas une extraction.

## Dernier état opérationnel — à lire en priorité

Le runner Cloudflare est validé réellement sur le code `8091ce0` : carrousel et
vidéo terminés en une tentative, 8 artefacts privés, preuves SQL, zéro appel IA.
Le conteneur est arrêté à vide (`idle`), le compte de recette est désactivé et
ses 4 sessions sont expirées. Les checks qualité/Docker et deux déploiements
Cloudflare sont verts sur ce SHA. Les commits documentaires suivants ne changent
pas cette recette. Relevé : [docs/receipts/2026-11-05-cloudflare-media.json](docs/receipts/2026-11-05-cloudflare-media.json).

Le dernier `lastError` de l’objet est historique ; ne pas conclure à une panne
si phase=idle et les jobs sont completed. Deux incompatibilités fetch natives
ont été reproduites et corrigées. Ne pas retester en consommant des médias
réels ou des appels OpenAI sans nécessité.

## PRA Production — décision de simplification (11/11/2026)

Les six fichiers expérimentaux de restauration Docker locale, de récupération Storage via ordinateur et de lecture Storage dans Cloudflare MediaRunner ont été **retirés de la PR #128**, n'ayant jamais servi à une restauration réelle. Le code du runner média et les workflows existants de **rollback/staging** restent inchangés. Le chemin désormais unique pour PostgreSQL/Auth est la **restauration PHYSICAL Supabase Pro vers un nouveau projet isolé** (nouveau coût à valider), complétée séparément par une restauration effective des 13 objets Storage dans une destination isolée. Le forfait Pro et les backups fournisseur ne sont pas la preuve d'un restore réussi.

Voir [docs/64-production-private-backup.md](docs/64-production-private-backup.md). Maintenir PR #128 en **draft**, issue #16 **ouverte**, migrations/promotions Solo Production et Stripe Live désactivés jusqu'aux preuves.
