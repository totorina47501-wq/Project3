// Prépare un upload directement dans le Storage privé; aucun appel à OpenAI.
import { requireUser, publicError, HttpError } from '@/lib/security/auth';
import { isSameOrigin } from '@/lib/security/origin';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { mediaPrepareSchema, isVideo, mediaExtension, MAX_CAROUSEL_IMAGES } from '@/lib/media/validation';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const { user } = await requireUser();
    if (!isSameOrigin(request)) throw new HttpError(403, 'Origine interdite.');
    let input: unknown;
    try { input = await request.json(); }
    catch { throw new HttpError(400, 'JSON incorrect.'); }
    const parsed = mediaPrepareSchema.safeParse(input);
    if (!parsed.success) throw new HttpError(422, 'Format, taille ou durée du média non autorisé.');

    const admin = createAdminSupabase();
    const { data: account, error: accountError } = await admin.from('users')
      .select('plan').eq('id', user.id).single();
    if (accountError || !account) throw new HttpError(503, 'Compte indisponible.');
    await checkRateLimit(user.id, account.plan);
    const { count: activeCount, error: countError } = await admin.from('media_assets')
      .select('id', { head: true, count: 'exact' })
      .eq('user_id', user.id).gt('expires_at', new Date().toISOString());
    if (countError) throw new Error('Impossible de vérifier les limites de stockage.');
    if ((activeCount ?? 0) >= 40) throw new HttpError(429,
      'Limite de médias temporaires atteinte. Supprime les anciens fichiers.');

    if (parsed.data.groupId) {
      const { count: grouped, error } = await admin.from('media_assets')
        .select('id', { head: true, count: 'exact' })
        .eq('user_id', user.id).eq('group_id', parsed.data.groupId)
        .gt('expires_at', new Date().toISOString());
      if (error) throw new Error('Vérification de carrousel indisponible.');
      if ((grouped ?? 0) >= MAX_CAROUSEL_IMAGES)
        throw new HttpError(422, 'Maximum cinq images dans un carrousel.');
    }

    const path = user.id + '/' + crypto.randomUUID() + '.' + mediaExtension(parsed.data.mime);
    const payload = {
      user_id: user.id, storage_path: path,
      group_id: parsed.data.groupId ?? null,
      kind: isVideo(parsed.data.mime) ? 'video' : 'image',
      mime_type: parsed.data.mime,
      declared_bytes: parsed.data.size,
      duration_seconds: parsed.data.durationSeconds ?? null,
      status: 'pending',
    };
    const { data: record, error: insertError } = await admin.from('media_assets')
      .insert(payload).select('id').single();
    if (insertError || !record) throw new Error('Préparation du média impossible.');
    const { data: signed, error: signingError } = await admin.storage.from('verification-media')
      .createSignedUploadUrl(path);
    if (signingError || !signed?.token) {
      await admin.from('media_assets').delete().eq('id', record.id).eq('user_id', user.id);
      throw new Error('Autorisation de téléversement impossible.');
    }
    return Response.json({
      assetId: record.id, path, token: signed.token,
      kind: payload.kind,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const { status, message } = publicError(error);
    return Response.json({ error: message }, {
      status, headers: { 'Cache-Control': 'no-store' },
    });
  }
}
