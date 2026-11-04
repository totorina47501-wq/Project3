import { isSameOrigin } from '@/lib/security/origin';
// Chemin : app/api/auth/logout/route.ts
import { createServerSupabase } from '@/lib/supabase/server';
import { publicError } from '@/lib/security/auth';

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return Response.json({ error: 'Origine interdite.' }, { status: 403 });
    const client = await createServerSupabase();
    await client.auth.signOut();
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const { status, message } = publicError(error);
    return Response.json({ error: message }, { status });
  }
}
