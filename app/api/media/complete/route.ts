// Confirme qu'un objet réellement présent appartient au créateur.
import { z } from 'zod';
import { requireUser, publicError, HttpError } from '@/lib/security/auth';
import { isSameOrigin } from '@/lib/security/origin';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { hashPrivateMedia } from '@/lib/evidence/private-media';

export const runtime = 'nodejs';
const schema = z.object({ assetId: z.string().uuid() }).strict();
export async function POST(request: Request) {
  try {
    const { user } = await requireUser();
    if (!isSameOrigin(request)) throw new HttpError(403, 'Origine interdite.');
    const payload = schema.safeParse(await request.json());
    if (!payload.success) throw new HttpError(400, 'Média invalide.');
    const admin = createAdminSupabase();
    const { data: item, error } = await admin.from('media_assets')
      .select('id,storage_path,status,mime_type,declared_bytes,expires_at')
      .eq('id', payload.data.assetId).eq('user_id', user.id).single();
    if (error || !item) throw new HttpError(404, 'Média introuvable.');
    if (Date.parse(item.expires_at) <= Date.now()) {
      throw new HttpError(410, 'L’autorisation de ce média a expiré.');
    }
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
    // The digest is derived from the actual private object, not from a URL or
    // client-provided value. Keep the historical verification hash unchanged.
    // Do not mark an upload ready if its bytes cannot be verified.
    let mediaSha256: string;
    try {
      mediaSha256 = await hashPrivateMedia(
        admin.storage.from('verification-media'),
        item.storage_path,
        size,
      );
    } catch {
      throw new HttpError(422, 'Impossible de vérifier les octets du média.');
    }
    const { data: updated, error: updateError } = await admin.from('media_assets')
      .update({
        status: 'ready', actual_bytes: size,
        completed_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
      })
      .eq('id', item.id).eq('user_id', user.id).eq('status', 'pending')
      .gt('expires_at', new Date().toISOString()).select('id').maybeSingle();
    if (!updated && !updateError) throw new HttpError(409, 'Média expiré ou déjà modifié.');
    if (updateError) throw new Error('Confirmation du média impossible.');
    return Response.json({ ready: true, mediaSha256 }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const { status, message } = publicError(error);
    return Response.json({ error: message }, {
      status, headers: { 'Cache-Control': 'no-store' },
    });
  }
}
