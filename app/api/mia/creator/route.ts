import { isSameOrigin } from '@/lib/security/origin';
import { HttpError, publicError, requireUser } from '@/lib/security/auth';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { consumeQuota, refundQuota } from '@/lib/security/quota';
import { openaiReadiness } from '@/lib/openai/config';
import { ModelOutputError } from '@/lib/openai/errors';
import {
  creatorInputSchema,
  extractOmissions,
  generateCreatorDraft,
  safePublishLimits,
  supportedSafePublishRules,
} from '@/lib/mia/creator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let charged = false;
  let quotaPeriod: string | null = null;
  let userId: string | null = null;
  try {
    if (!isSameOrigin(request)) {
      return Response.json({ error: 'Origine interdite.' }, { status: 403 });
    }
    const { user } = await requireUser();
    userId = user.id;
    const body = creatorInputSchema.safeParse(await request.json());
    if (!body.success) {
      throw new HttpError(422, 'Entrées invalides pour Mia Creator.');
    }

    const ai = openaiReadiness(process.env);
    if (!ai.textEnabled || !ai.keyConfigured) {
      throw new HttpError(503,
        'Generation IA indisponible. Tu peux utiliser SafePublish sans IA via Check ma publication.');
    }

    const admin = createAdminSupabase();
    const { data: profile, error } = await admin.from('users')
      .select('plan').eq('id', user.id).single();
    if (error || !profile) throw new HttpError(503, 'Profil Supabase indisponible.');

    await checkRateLimit(user.id, profile.plan);
    quotaPeriod = await consumeQuota(user.id, 'mia');
    charged = true;

    const draft = await generateCreatorDraft(body.data);
    const omissions = extractOmissions(body.data.isPartnership, draft.precheckViolations);

    const { error: usageError } = await admin.from('ai_analyses').insert({
      user_id: user.id,
      verification_id: null,
      stage: 'assistant',
      model_used: draft.usage.model,
      prompt_tokens: draft.usage.promptTokens,
      completion_tokens: draft.usage.completionTokens,
      latency_ms: draft.usage.latencyMs,
      cost_usd: draft.usage.estimatedCostUsd,
      raw_response: {
        source: 'mia_creator',
        platform: body.data.platform,
        partnership: body.data.isPartnership,
      },
    });
    if (usageError) throw new HttpError(503, 'Journalisation Mia Creator indisponible.');

    charged = false;
    return Response.json({
      hooks: draft.hooks,
      script: draft.script,
      caption: draft.caption,
      cta: draft.cta,
      manualPlatformChecks: draft.manualPlatformChecks,
      safePublish: {
        supportedRules: supportedSafePublishRules,
        precheckViolations: draft.precheckViolations,
        omissions,
        limits: safePublishLimits(body.data.platform),
      },
      disclaimer: 'Generation de texte != verification juridique != garantie de conformite.',
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof ModelOutputError && userId) {
      await createAdminSupabase().from('ai_analyses').insert({
        user_id: userId,
        verification_id: null,
        stage: 'assistant',
        model_used: error.usage.model,
        prompt_tokens: error.usage.promptTokens,
        completion_tokens: error.usage.completionTokens,
        latency_ms: error.usage.latencyMs,
        cost_usd: error.usage.estimatedCostUsd,
        raw_response: { source: 'mia_creator', status: 'invalid_output', kind: error.kind },
      });
    }
    if (charged && userId && quotaPeriod) {
      await refundQuota(userId, 'mia', quotaPeriod);
    }
    const { status, message } = publicError(error);
    if (status === 429 || status === 503) {
      return Response.json({
        error: status === 429
          ? 'Generation IA indisponible. Quota Mia du mois atteint. Utilise SafePublish sans IA via Check ma publication.'
          : 'Generation IA indisponible. Utilise SafePublish sans IA via Check ma publication.',
      }, { status, headers: { 'Cache-Control': 'no-store' } });
    }
    return Response.json({ error: message }, { status,
      headers: { 'Cache-Control': 'no-store' } });
  }
}
