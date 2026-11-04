import { isSameOrigin } from '@/lib/security/origin';
// Chemin : app/api/rewrite/accept/route.ts
import { z } from 'zod';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { requireUser, publicError } from '@/lib/security/auth';
import { hasClearLeadingDisclosure, needsVisibleDisclosure } from '@/lib/ai/disclosure';

const schema = z.object({
  verificationId: z.string().uuid(),
  caption: z.string().trim().min(1).max(10000),
}).strict();

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return Response.json({ error: 'Origine interdite.' }, { status: 403 });
    const { user } = await requireUser();
    const data = schema.safeParse(await request.json());
    if (!data.success) return Response.json({ error: 'Texte invalide.' }, { status: 400 });
    const admin = createAdminSupabase();
    const { data: check, error } = await admin.from('verifications')
      .select('content_text,prompt_version,status,ai_explanation')
      .eq('id', data.data.verificationId).eq('user_id', user.id).single();
    if (error || !check) return Response.json({ error: 'Vérification introuvable.' }, { status: 404 });
    const explanation = check.ai_explanation as { violations?: Array<{ code?: string }> } | null;
    const flags = explanation?.violations ?? [];
    if (needsVisibleDisclosure(flags.filter((item): item is { code: string } =>
      typeof item?.code === 'string')) &&
      !hasClearLeadingDisclosure(data.data.caption)) {
      // Règle produit de visibilité, non certification juridique.
      return Response.json({
        error: 'Pour une légende sponsorisée, place une mention explicite (« Publicité » ou « Collaboration commerciale ») au début avant de l’accepter.',
      }, { status: 422, headers: { 'Cache-Control': 'no-store' } });
    }
    if (check.status !== 'completed') return Response.json({
      error: 'Cette vérification est déjà finalisée.',
    }, { status: 409 });
    const { data: updated, error: updateError } = await admin.from('verifications')
      .update({ status: 'accepted', accepted_caption: data.data.caption })
      .eq('id', data.data.verificationId).eq('user_id', user.id)
      .eq('status', 'completed').select('id').single();
    if (updateError || !updated) return Response.json({ error: 'Enregistrement impossible.' }, { status: 409 });
    const { data: profile } = await admin.from('users').select('ai_training_opt_in')
      .eq('id', user.id).single();
    const { error: feedbackError } = await admin.from('rewrite_feedback').insert({
      user_id: user.id,
      verification_id: data.data.verificationId,
      original_caption: check.content_text,
      accepted_caption: data.data.caption,
      prompt_version: check.prompt_version ?? 'v1.0',
      training_consent_snapshot: profile?.ai_training_opt_in === true,
    });
    if (feedbackError) throw new Error('Enregistrement du feedback impossible.');
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const { status, message } = publicError(error);
    return Response.json({ error: message }, { status });
  }
}
