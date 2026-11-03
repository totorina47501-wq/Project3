// Chemin : app/api/auth/login/route.ts
import { z } from 'zod';
import { createServerSupabase } from '@/lib/supabase/server';
import { publicError } from '@/lib/security/auth';
import { missingAuthConfig, categorizeAuthError } from '@/lib/security/auth-diagnostics';

const credentials = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(200),
}).strict();

export async function POST(request: Request) {
  try {
    const body = credentials.safeParse(await request.json());
    if (!body.success) return Response.json({ error: 'Identifiants invalides.' }, { status: 400 });
    // Les variables NEXT_PUBLIC_ doivent aussi exister dans l'environnement
    // d'exécution du Worker, pas uniquement pendant la compilation.
    const missingVariables = missingAuthConfig({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    });
    if (missingVariables.length > 0) {
      console.error('[mentioncheck][auth_login_failure]', {
        category: 'missing_runtime_config', missingVariables,
      });
      return Response.json({ error: 'Configuration du service de connexion indisponible.' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
    const client = await createServerSupabase();
    const { error } = await client.auth.signInWithPassword(body.data);
    if (error) {
      const category = categorizeAuthError(error);
      if (category === 'invalid_credentials') {
        return Response.json({ error: 'Email ou mot de passe incorrect.' },
          { status: 401, headers: { 'Cache-Control': 'no-store' } });
      }
      console.error('[mentioncheck][auth_login_failure]', {
        category, providerStatus: typeof error.status === 'number' ? error.status : null,
      });
      return Response.json({
        error: category === 'rate_limited'
          ? 'Trop de tentatives. Réessaie plus tard.'
          : 'Le service de connexion est momentanément indisponible.',
      }, { status: category === 'rate_limited' ? 429 : 503,
        headers: { 'Cache-Control': 'no-store' } });
    }
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    // Diagnostic sans messages bruts, sans emails, mots de passe ni jetons.
    console.error('[mentioncheck][auth_login_failure]', {
      category: categorizeAuthError(error),
      errorType: error instanceof Error ? error.name : 'unknown',
      runtimeUrlPresent: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      runtimeKeyPresent: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    });
    const { status, message } = publicError(error);
    return Response.json({ error: message }, { status });
  }
}
