# MentionCheck — diagnostic Cloudflare Preview staging (9 novembre 2026)

## Périmètre

- Branche `test/mentioncheck-staging-auth-20261108`, PR #99 **draft non fusionnée**.
- Cible Cloudflare unique : Worker `mentioncheck-staging`, projet Supabase staging `ukvgnkxgzyhswgpnvyzz`.
- Production `mentioncheck` et branche `main` non touchées ; aucune clé serveur, commande de production, facturation ou appel OpenAI.

## Preuves

- [Run #42534292007](https://github.com/totorina47501-wq/Project3/actions/runs/42534292007) : garde-fous staging + Preview PASS ; `npm ci`, build Next.js, package OpenNext et `wrangler deploy --dry-run` sur config de staging PASS.
- `wrangler preview` a terminé avec un statut CLI 0 : **une Preview QA a été créée** sous le Worker staging. La création d'une Preview n'est pas un déploiement du Worker production.
- L'URL publique était absente de la sortie. Cloudflare connaît un [bug Wrangler JSON/Assets #16028](https://github.com/cloudflare/workers-sdk/issues/16028) : la progression d'assets précède le JSON. Ce bogue peut expliquer l'échec de parsing, mais l'absence d'URL est vérifiée **indépendamment**.
- [Run diagnostic en lecture seule #42534677039](https://github.com/totorina47501-wq/Project3/actions/runs/42534677039) : GET API Cloudflare du Worker staging, **exactement une Preview QA** présente :
  - Nom : `qa-cert-11cba5d3`
  - ID : `c66150302c8f40f3824957d9f3a20f67`
  - `urls=[]` ; sous-domaine staging : `previews_enabled=false`
- [Run nettoyage #42534888092](https://github.com/totorina47501-wq/Project3/actions/runs/42534888092) : suppression explicitement ciblée par ID après vérification du nom. Refus Cloudflare **HTTP 403** (jeton CI insuffisant pour cette opération ou restriction API). La Preview QA existe encore ; elle n'a **aucune URL publique**, mais sa suppression n'est pas validée. Ne pas répéter des créations.
- Le contrôle du correctif `previews` est seulement **partiel** : le Worker staging a été packagé, dry-run validé, et une Preview créée ; le smoke HTTP preview n'a pas été possible. Le build historique du Worker production reste un échec, tant qu'un nouveau build Cloudflare sur la configuration corrigée n'a pas été exécuté.
- Correctif préventif : vérifier `previews_enabled` **avant** `wrangler preview` ; ne plus créer de previews orphelines. Parser le JSON après les messages de progression d'assets.

## Actions humaines minimales

1. Dans Cloudflare, **Workers & Pages → mentioncheck-staging → Previews**, supprimer uniquement la Preview `qa-cert-11cba5d3` (ou donner au jeton CI les droits de suppression limités à ce Worker). **Ne pas supprimer le Worker lui-même.**
2. Pour obtenir un smoke HTTP Preview, activer les **Preview URLs du seul Worker staging**. Les URLs de preview sont publiques par défaut : vérifier ce choix de sécurité avant activation, et configurer l'accès si nécessaire.
3. Une fois la Preview QA supprimée et les paramètres approuvés, relancer le workflow de certification, puis désactiver les URLs Preview si elles ne sont plus requises.
4. Validation du **build Cloudflare de production** après merge/autorisation explicite : non exécutée dans ce lot.

La restauration réelle du schéma staging (run #42528880867), l'Auth A/B (run #42519296878) et le rollback staging entre versions équivalentes (run #42522596101) restent des preuves PASS indépendantes. Issue #16 **ouverte**, label `release:evidence-required`. Aucune dépense IA payante.

**Verdict : Cloudflare Preview STAGING PARTIEL / nettoyage bloqué par HTTP 403, certification globale toujours ouverte.**
