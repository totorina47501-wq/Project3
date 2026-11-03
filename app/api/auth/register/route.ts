// Chemin : app/api/auth/register/route.ts
import { z } from 'zod';
import { createServerSupabase } from '@/lib/supabase/server';
import { publicError } from '@/lib/security/auth';

const credentials = z.object({
  email: z.string().email().max(320),
  password: z.string().min(10).max(200),
}).strict();

export async function POST(request: Request) {
  try {
    const body = credentials.safeParse(await request.json());
    if (!body.success) return Response.json({
      error: 'Email invalide ou mot de passe trop court (10 caractères minimum).',
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
