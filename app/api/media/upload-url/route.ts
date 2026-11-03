// Chemin : app/api/media/upload-url/route.ts
import { z } from 'zod';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { requireUser, publicError } from '@/lib/security/auth';

export const runtime = 'nodejs';
const schema = z.object({
  mime: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  size: z.number().int().min(1).max(8 * 1024 * 1024),
}).strict();

export async function POST(request: Request) {
  try {
    const { user } = await requireUser();
    const payload = schema.safeParse(await request.json());
    if (!payload.success) {
      return Response.json({ error: 'Image invalide (8 Mo maximum).' }, { status: 400 });
    }
    const ext = {
      'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    }[payload.data.mime];
    const path = user.id + '/' + crypto.randomUUID() + '.' + ext;
    const { data, error } = await createAdminSupabase()
      .storage.from('verification-media').createSignedUploadUrl(path);
    if (error || !data) throw new Error('Impossible de préparer le téléversement.');
    return Response.json({ path, token: data.token }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({ error: 'JSON invalide.' }, { status: 400 });
    const { status, message } = publicError(error);
    return Response.json({ error: message }, { status });
  }
}
