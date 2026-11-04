// Supprime un fichier préparé et sa ligne, sans jamais agir sur un autre compte.
import { z } from 'zod';
import { requireUser, publicError, HttpError } from '@/lib/security/auth';
import { isSameOrigin } from '@/lib/security/origin';
import { createAdminSupabase } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
const schema = z.object({ assetId: z.string().uuid() }).strict();
export async function POST(request: Request) {
  try {
    const { user } = await requireUser();
    if (!isSameOrigin(request)) throw new HttpError(403, 'Origine interdite.');
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) throw new HttpError(400, 'Identifiant invalide.');
    const admin = createAdminSupabase();
    const { data: item, error } = await admin.from('media_assets')
      .select('id,storage_path').eq('id', parsed.data.assetId)
      .eq('user_id', user.id).single();
    if (error || !item) throw new HttpError(404, 'Média introuvable.');
    // Un média devenu élément de preuve ne peut être supprimé via la bibliothèque.
    const { data: used, error: lookupError } = await admin.from('verifications')
      .select('id').eq('user_id', user.id)
      .eq('media_url', item.storage_path).limit(1);
    if (lookupError) throw new Error('Référence du média indisponible.');
    if (used?.length) throw new HttpError(409,
      'Ce média est lié à un contrôle archivé et ne peut pas être supprimé ici.');
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
