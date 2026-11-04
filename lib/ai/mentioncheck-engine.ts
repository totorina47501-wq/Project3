// Chemin : lib/ai/mentioncheck-engine.ts
import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { analyzeText } from '@/lib/ai/text-analyzer';
import { analyzeVisual } from '@/lib/ai/vision-analyzer';
import { rewriteCompliant } from '@/lib/ai/rewriter';
import { applyRules, riskFrom, levelFromRisk } from '@/lib/ai/rules';
import { PROMPT_VERSION } from '@/lib/ai/prompts';
import type {
  AnalysisResult, MediaType, Platform, Violation, ModelTelemetry,
} from '@/lib/ai/schemas';
import { HttpError } from '@/lib/security/auth';
import { reportAiFailure } from '@/lib/ai/failure';

type Input = {
  caption: string;
  platform: Platform;
  mediaUrl?: string | undefined;
  mediaType?: MediaType;
  userId: string;
};
type Emit = (event: string, data: unknown) => void;

async function digestSha256(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const bytes = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function validateMedia(userId: string, path: string) {
  if (!path.startsWith(userId + '/')
      || !/^[a-f0-9-]{36}\.(?:jpg|png|webp)$/.test(path.slice(userId.length + 1))) {
    throw new HttpError(403, 'Ce média ne peut pas être utilisé.');
  }
  const admin = createAdminSupabase();
  const bucket = admin.storage.from('verification-media');
  const { data: info, error } = await bucket.info(path);
  if (error || !info || !info.size || info.size > 8 * 1024 * 1024
      || !['image/jpeg', 'image/png', 'image/webp'].includes(info.contentType || '')) {
    throw new HttpError(422, 'Image indisponible ou format non autorisé (8 Mo max).');
  }
  const { data, error: signedError } = await bucket.createSignedUrl(path, 120);
  if (signedError || !data?.signedUrl) {
    throw new HttpError(503, 'Impossible de lire le média privé.');
  }
  return data.signedUrl;
}

async function recordUsage(verificationId: string, stage: string, usage: ModelTelemetry, raw: unknown) {
  const admin = createAdminSupabase();
  const { error } = await admin.from('ai_analyses').insert({
    verification_id: verificationId,
    stage,
    model_used: usage.model,
    prompt_tokens: usage.promptTokens,
    completion_tokens: usage.completionTokens,
    latency_ms: usage.latencyMs,
    cost_usd: usage.estimatedCostUsd,
    // Résumé minimisé : ne conserver ni légende ni média dans le journal brut.
    raw_response: { version: PROMPT_VERSION, metrics: raw },
  });
  if (error) throw new Error('Échec de journalisation IA.');
}

export async function runCheck(input: Input, emit: Emit = () => {}): Promise<AnalysisResult> {
  const admin = createAdminSupabase();
  const mediaType = input.mediaType ?? 'none';

  if (mediaType !== 'none' && mediaType !== 'image') {
    throw new HttpError(422, 'Seules les images sont prises en charge pour cette première version.');
  }
  // Ne jamais prendre une URL distante arbitraire : accès à un bucket privé validé.
  const signedUrl = input.mediaUrl
    ? await validateMedia(input.userId, input.mediaUrl)
    : undefined;

  const { data: inserted, error: insertError } = await admin
    .from('verifications')
    .insert({
      user_id: input.userId,
      content_text: input.caption,
      platform: input.platform,
      media_type: mediaType,
      media_url: input.mediaUrl ?? null,
      status: 'processing',
      prompt_version: PROMPT_VERSION,
    })
    .select('id')
    .single();
  if (insertError || !inserted) throw new Error('Impossible de créer la vérification.');
  const verificationId: string = inserted.id;

  try {
    emit('scan_text', { status: 'running' });
    if (signedUrl) emit('scan_visual', { status: 'running' });

    // Les contrôles déterministes restent disponibles si le fournisseur IA échoue.
    const textTask = analyzeText(input.caption, input.platform)
      .then((result) => {
        emit('scan_text', { status: 'complete' });
        return result;
      });
    const visualTask = signedUrl
      ? analyzeVisual(signedUrl, 'image').then((result) => {
        emit('scan_visual', { status: 'complete' });
        return result;
      })
      : Promise.resolve(null);

    const [textOutcome, visualOutcome] = await Promise.allSettled([textTask, visualTask]);
    const text = textOutcome.status === 'fulfilled' ? textOutcome.value : null;
    const visual = visualOutcome.status === 'fulfilled' ? visualOutcome.value : null;
    let analysisMode: AnalysisResult['analysisMode'] = 'full';
    const warnings: string[] = [];
    if (textOutcome.status === 'rejected') {
      reportAiFailure('text', textOutcome.reason);
      analysisMode = 'rules_only';
      warnings.push('Le service IA est indisponible : seuls les contrôles automatisés des mentions ont été effectués.');
      emit('scan_text', { status: 'unavailable' });
    }
    if (signedUrl && visualOutcome.status === 'rejected') {
      reportAiFailure('vision', visualOutcome.reason);
      if (analysisMode !== 'rules_only') analysisMode = 'partial';
      warnings.push("L'analyse du visuel est momentanément indisponible.");
      emit('scan_visual', { status: 'unavailable' });
    }
    if (text) {
      await recordUsage(verificationId, 'text', text.usage,
        { flags: text.aiFlags.length, violations: text.ruleViolations.length });
    }
    if (visual) {
      await recordUsage(verificationId, 'vision', visual.usage,
        { hasBrandLogo: visual.hasBrandLogo, hasPromoCode: visual.hasPromoCode });
    }
    const violations: Violation[] = applyRules(input.caption, input.platform);
    const aiFlags = text ? [...text.aiFlags] : [];
    // Un logo est une observation, pas une preuve de contrepartie.
    if (visual?.hasBrandLogo) {
      aiFlags.push({
        title: 'Marque détectée dans le visuel',
        explanation: 'Vérifie la transparence si une contrepartie commerciale existe.',
        confidence: visual.confidence,
      });
    }
    emit('scoring', { status: 'running' });
    const confidence = aiFlags.length
      ? Math.max(...aiFlags.map((flag) => flag.confidence))
      : 0;
    const risk = riskFrom(violations, confidence);
    const score = 100 - risk;
    const riskLevel = levelFromRisk(risk);
    emit('scoring', { status: 'complete', score, riskLevel });

    let rewrite: AnalysisResult['rewrite'] = null;
    if (score < 60 && text) {
      // La génération automatique consomme le quota de réécritures du plan.
      const { data: allowed, error: quotaError } = await admin.rpc('consume_usage_quota', {
        p_user_id: input.userId, p_action: 'rewrite',
      });
      if (quotaError) throw new Error('Quota de réécriture indisponible.');
      if (allowed) {
        emit('rewriting', { status: 'running' });
        try {
          const suggested = await rewriteCompliant(input.caption, violations);
          rewrite = {
            rewrittenCaption: suggested.rewrittenCaption,
            changes: suggested.changes,
            confidence: suggested.confidence,
          };
          await recordUsage(verificationId, 'rewrite', suggested.usage,
            { changes: suggested.changes.length, confidence: suggested.confidence });
          emit('rewriting', { status: 'complete' });
        } catch (error) {
          reportAiFailure('rewrite', error);
          await admin.rpc('refund_usage_quota', {
            p_user_id: input.userId, p_action: 'rewrite',
          });
          if (analysisMode === 'full') analysisMode = 'partial';
          warnings.push("La réécriture IA n'a pas pu être générée.");
          emit('rewriting', { status: 'unavailable' });
        }
      } else {
        emit('rewriting', { status: 'quota_exceeded' });
      }
    }

    // Hash canonique de la légende, plateforme et chemin privé.
    // La preuve binaire du fichier nécessite un hash d'upload séparé.
    const hashSha256 = await digestSha256(
      JSON.stringify({ caption: input.caption, mediaUrl: input.mediaUrl ?? null,
        platform: input.platform, mediaType }),
    );
    const result: AnalysisResult = {
      score, riskLevel, violations, aiFlags, rewrite, hashSha256, verificationId,
      analysisMode, warnings,
    };
    const { error: updateError } = await admin.from('verifications').update({
      ai_score: score,
      ai_risk_level: riskLevel,
      ai_explanation: { violations, aiFlags, analysisMode, warnings, scoringVersion: PROMPT_VERSION },
      ai_rewrite_suggestion: rewrite?.rewrittenCaption ?? null,
      hash_sha256: hashSha256,
      status: 'completed',
      completed_at: new Date().toISOString(),
    }).eq('id', verificationId).eq('user_id', input.userId);
    if (updateError) throw new Error('Impossible de finaliser la vérification.');
    if (analysisMode === 'rules_only') {
      // Aucun appel IA réussi : cette vérification n'épuise pas le quota payant.
      const { error: refundError } = await admin.rpc('refund_usage_quota', {
        p_user_id: input.userId, p_action: 'check',
      });
      if (refundError) console.error('[mentioncheck][quota_refund_failed]');
    }
    return result;
  } catch (error) {
    await admin.from('verifications').update({ status: 'failed' })
      .eq('id', verificationId).eq('user_id', input.userId);
    throw error;
  }
}
