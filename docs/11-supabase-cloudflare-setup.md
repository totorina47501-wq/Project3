# Connexion Supabase + Cloudflare pour MentionCheck

Chemin : docs/11-supabase-cloudflare-setup.md

## 1. Supabase

Ouvrir https://supabase.com/dashboard, créer ou choisir le projet Supabase existant.
Dans Project Settings > API (ou Connect), récupérer l'URL du projet et la clé publique publishable / anon.
NE JAMAIS partager ni copier la clé service_role dans GitHub ou un chat.

Dans SQL Editor, exécuter en ordre :

1. supabase/migrations/202611032001_initial_schema.sql
2. supabase/migrations/202611032002_rls_and_functions.sql
3. supabase/migrations/202611032003_pgvector_match.sql
4. supabase/migrations/202611032004_quotas.sql
5. supabase/seed.sql
6. tests/sql/security_smoke.sql

Dans Authentication > URL Configuration, définir Site URL :

    https://mentioncheck.toto-rina47501.workers.dev

Vérifier que le fournisseur Email est actif et que la confirmation email est configurée.

## 2. Cloudflare

Dans Workers & Pages > mentioncheck > Settings > Variables and Secrets :

NEXT_PUBLIC_SUPABASE_URL = URL Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY = clé publique Supabase
SUPABASE_SERVICE_KEY = clé service_role (Secret)
OPENAI_API_KEY = nouvelle clé privée OpenAI (Secret)
NEXT_PUBLIC_APP_URL = URL du Worker

Les variables NEXT_PUBLIC sont nécessaires au moment du BUILD Next.js et à l'exécution. Dans la configuration Workers Builds, définir les deux variables publiques aussi comme Build Variables selon la console Cloudflare.

Changer de build après ces modifications : les valeurs publiques sont insérées dans les bundles navigateur à la compilation.

## 3. Vérifier

- Ouvrir /register, créer un compte de test puis valider l'email.
- Ouvrir /login et s'authentifier.
- Ouvrir /dashboard/check et tester une légende sans mention.
- Tester un post explicitement marqué PUBLICITÉ.
- Tester l'upload WebP d'une image.
- Vérifier que verifications et ai_analyses contiennent les enregistrements attendus.
- Tester deux utilisateurs distincts pour confirmer l'isolation RLS.
- Vérifier usage_monthly après 1 vérification puis après 1 réécriture.

## 4. Incidents courants

- /login affiche 'service indisponible' : vérifier les variables Cloudflare runtime et la valeur de build.
- Compte créé mais login refusé : vérifier la confirmation email Supabase.
- API /api/check retourne 503 : vérifier OPENAI_API_KEY et la migration de quota.
- Téléversement refusé : vérifier le bucket privé verification-media et Storage RLS.
- Build Next.js réussi mais erreur 500 sur /dashboard : revérifier NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY.

Cloudflare reste l'unique hébergeur de l'application. Supabase et OpenAI sont des services managés nécessaires au traitement.
