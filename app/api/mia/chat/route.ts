import { isSameOrigin } from '@/lib/security/origin';
// Chemin : app/api/mia/chat/route.ts
// Mia documentaire : authentification, quotas, isolation et historique privé.
import { requireUser, HttpError, publicError } from '@/lib/security/auth';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { miaQuestionSchema, miaMessageSchema, type MiaMessage } from '@/lib/mia/schemas';
import { answerMia } from '@/lib/mia/assistant';
import { consumeQuota, refundQuota } from '@/lib/security/quota';
import { checkRateLimit } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let charged = false;
  let userId: string | null = null;
  try {
    if (!isSameOrigin(request)) return Response.json({ error: 'Origine interdite.' }, { status: 403 });
    const { user } = await requireUser();
    userId = user.id;
    let body: unknown;
    try { body = await request.json(); }
    catch { throw new HttpError(400, 'Requête JSON invalide.'); }
    const parsed = miaQuestionSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(422, 'Question invalide (3 à 1 600 caractères).');

    const admin = createAdminSupabase();
    const { data: profile, error: profileError } = await admin.from('users')
      .select('plan').eq('id', user.id).single();
    if (profileError || !profile) throw new Error('Profil inaccessible.');

    let history: MiaMessage[] = [];
    let verificationId = parsed.data.verificationId;
    if (parsed.data.conversationId) {
      const { data: conversation, error } = await admin.from('assistant_conversations')
        .select('id,messages,verification_id').eq('id', parsed.data.conversationId)
        .eq('user_id', user.id).single();
      if (error || !conversation) throw new HttpError(404, 'Conversation introuvable.');
      const saved = Array.isArray(conversation.messages) ? conversation.messages : [];
      if (saved.length >= 40) throw new HttpError(409,
        'Cette discussion est complète. Démarre une nouvelle conversation.');
      history = saved.flatMap((entry) => {
        const checked = miaMessageSchema.safeParse(entry);
        return checked.success ? [checked.data] : [];
      });
      if (verificationId && verificationId !== conversation.verification_id) {
        throw new HttpError(422, 'Cette vérification ne correspond pas à la conversation.');
      }
      verificationId = conversation.verification_id ?? undefined;
    }

    let context: { caption?: string; status?: string } = {};
    if (verificationId) {
      const { data: check, error } = await admin.from('verifications')
        .select('content_text,status').eq('id', verificationId).eq('user_id', user.id).single();
      if (error || !check) throw new HttpError(404, 'Vérification introuvable.');
      context = { caption: check.content_text, status: check.status };
    }
    await checkRateLimit(user.id, profile.plan);
    await consumeQuota(user.id, 'mia');
    charged = true;
    const output = await answerMia(parsed.data.question, history, context);
    const exchange: MiaMessage[] = [
      { role: 'user', content: parsed.data.question },
      { role: 'assistant', content: output.answer, sources: output.sources },
    ];

    let conversationId = parsed.data.conversationId;
    if (conversationId) {
      const { data: appended, error } = await admin.rpc('append_mia_exchange', {
        p_user_id: user.id, p_conversation_id: conversationId,
        p_exchange: exchange,
      });
      if (error || !appended) throw new HttpError(409,
        'Impossible de poursuivre cette conversation. Démarre une nouvelle discussion.');
    } else {
      const { data: created, error } = await admin.from('assistant_conversations')
        .insert({ user_id: user.id, verification_id: verificationId ?? null,
          messages: exchange }).select('id').single();
      if (error || !created) throw new Error('Sauvegarde de la discussion impossible.');
      conversationId = created.id;
    }
    charged = false;
    // Métriques minimisées : jamais de texte utilisateur ni d'identifiant de conversation.
    console.log('[mentioncheck][mia_usage]', {
      promptTokens: output.usage.promptTokens,
      completionTokens: output.usage.completionTokens,
      estimatedCostUsd: output.usage.estimatedCostUsd,
    });
    return Response.json({
      conversationId, answer: output.answer, sources: output.sources,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (charged && userId) await refundQuota(userId, 'mia');
    const { status, message } = publicError(error);
    return Response.json({ error: message }, { status,
      headers: { 'Cache-Control': 'no-store' } });
  }
}
