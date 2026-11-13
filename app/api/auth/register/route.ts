import { isSameOrigin } from '@/lib/security/origin';
// Chemin : app/api/auth/register/route.ts
import { z } from 'zod';
import { createServerSupabase } from '@/lib/supabase/server';
import { publicError } from '@/lib/security/auth';
import { acceptableRegistrationPassword } from '@/lib/security/password-policy';
import { requireAuthAttemptLimit } from '@/lib/security/auth-attempt-limit';

const credentials = z.object({
  email: z.string().email().max(320),
  password: z.string().min(12).max(200).refine(acceptableRegistrationPassword),
}).strict();

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return Response.json({ error: 'Origine interdite.' }, { status: 403 });
    await requireAuthAttemptLimit(request);
    const body = credentials.safeParse(await request.json());
    if (!body.success) return Response.json({
      error: 'Email invalide ou mot de passe non conforme (12 caractères minimum, minuscules, majuscules, chiffres et symbole).',
    }, { status: 400 });
    const client = await createServerSupabase();
    const { error } = await client.auth.signUp(body.data);
    if (error) return Response.json({
      error: 'Inscription impossible. Vérifie les informations et réessaie.',
    }, { status: 400 });
    return Response.json({
      ok: true,
      message: 'Si ton inscription est acceptée, vérifie ton email pour activer le compte.',
    }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const { status, message } = publicError(error);
    return Response.json({ error: message }, { status });
  }
}
