import { isSameOrigin } from '@/lib/security/origin';
// Chemin : app/api/mia/conversations/delete/route.ts
// Suppression explicite d'une discussion, limitée au propriétaire authentifié.
import { z } from 'zod';
import { requireUser, publicError, HttpError } from '@/lib/security/auth';
import { createAdminSupabase } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
const inputSchema = z.object({ conversationId: z.string().uuid() }).strict();
export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return Response.json({ error: 'Origine interdite.' }, { status: 403 });
    const { user } = await requireUser();
    let input: unknown;
    try { input = await request.json(); }
    catch { throw new HttpError(400, 'Requête invalide.'); }
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) throw new HttpError(422, 'Conversation invalide.');
    const { data, error } = await createAdminSupabase().from('assistant_conversations')
      .delete().eq('id', parsed.data.conversationId).eq('user_id', user.id)
      .select('id').maybeSingle();
    if (error) throw new Error('Suppression impossible.');
    if (!data) throw new HttpError(404, 'Conversation introuvable.');
    return Response.json({ deleted: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const { status, message } = publicError(error);
    return Response.json({ error: message }, { status });
  }
}
