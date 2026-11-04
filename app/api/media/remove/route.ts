// Supprime un fichier préparé et sa ligne, sans jamais agir sur un autre compte.
import { z } from 'zod';
import { requireUser, publicError, HttpError } from '@/lib/security/auth';
import { createAdminSupabase } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
const schema = z.object({ assetId: z.string().uuid() }).strict();
export async function POST(request: Request) {
  try {
    const { user } = await requireUser();
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) throw new HttpError(400, 'Identifiant invalide.');
    const admin = createAdminSupabase();
    const { data: item, error } = await admin.from('media_assets')
      .select('id,storage_path').eq('id', parsed.data.assetId)
      .eq('user_id', user.id).single();
    if (error || !item) throw new HttpError(404, 'Média introuvable.');
    const { error: fileError } = await admin.storage.from('verification-media')
      .remove([item.storage_path]);
    if (fileError) throw new Error('Suppression du fichier impossible.');
    const { error: deleteError } = await admin.from('media_assets')
      .delete().eq('id', item.id).eq('user_id', user.id);
    if (deleteError) throw new Error('Suppression du référencement impossible.');
    return Response.json({ deleted: true }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    const { status, message } = publicError(error);
    return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
