// Chemin : app/api/auth/login/route.ts
import { z } from 'zod';
import { createServerSupabase } from '@/lib/supabase/server';
import { publicError } from '@/lib/security/auth';

const credentials = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(200),
}).strict();

export async function POST(request: Request) {
  try {
    const body = credentials.safeParse(await request.json());
    if (!body.success) return Response.json({ error: 'Identifiants invalides.' }, { status: 400 });
    const client = await createServerSupabase();
    const { error } = await client.auth.signInWithPassword(body.data);
    if (error) return Response.json({ error: 'Email ou mot de passe incorrect.' }, { status: 401 });
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const { status, message } = publicError(error);
    return Response.json({ error: message }, { status });
  }
}
