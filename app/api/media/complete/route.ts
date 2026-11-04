// Confirme qu'un objet réellement présent appartient au créateur.
import { z } from 'zod';
import { requireUser, publicError, HttpError } from '@/lib/security/auth';
import { createAdminSupabase } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
const schema = z.object({ assetId: z.string().uuid() }).strict();
export async function POST(request: Request) {
  try {
    const { user } = await requireUser();
    const payload = schema.safeParse(await request.json());
    if (!payload.success) throw new HttpError(400, 'Média invalide.');
    const admin = createAdminSupabase();
    const { data: item, error } = await admin.from('media_assets')
      .select('id,storage_path,status,mime_type,declared_bytes')
      .eq('id', payload.data.assetId).eq('user_id', user.id).single();
    if (error || !item) throw new HttpError(404, 'Média introuvable.');
    if (item.status === 'ready') {
      return Response.json({ ready: true }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const { data: info, error: storageError } = await admin.storage
      .from('verification-media').info(item.storage_path);
    const size = info?.size;
    const mime = info?.contentType;
    if (storageError || !info || typeof size !== 'number' ||
      size !== item.declared_bytes || mime !== item.mime_type) {
      throw new HttpError(422, 'Fichier absent ou incohérent avec la déclaration.');
    }
    const { error: updateError } = await admin.from('media_assets')
      .update({
        status: 'ready', actual_bytes: size,
        completed_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
      })
      .eq('id', item.id).eq('user_id', user.id).eq('status', 'pending');
    if (updateError) throw new Error('Confirmation du média impossible.');
    return Response.json({ ready: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const { status, message } = publicError(error);
    return Response.json({ error: message }, {
      status, headers: { 'Cache-Control': 'no-store' },
    });
  }
}
