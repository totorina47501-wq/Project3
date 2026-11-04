// Moteur de contrôle sans aucun appel IA ou quota payant.
// Ne fournit jamais de validation juridique et ne traite pas les images.
import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { applyRules, riskFrom, levelFromRisk } from '@/lib/ai/rules';
import type { Platform, AnalysisResult } from '@/lib/ai/schemas';

type Input = { userId: string; caption: string; platform: Platform };
type Emit = (event: string, data: unknown) => void;
export async function runRulesOnlyCheck(input: Input, emit: Emit = () => {}): Promise<AnalysisResult> {
  const admin = createAdminSupabase();
  const { data: created, error } = await admin.from('verifications').insert({
    user_id: input.userId,
    platform: input.platform,
    content_text: input.caption,
    media_type: 'none',
    status: 'processing',
    prompt_version: 'rules-v1',
  }).select('id').single();
  if (error || !created) throw new Error('Impossible de démarrer le contrôle automatique.');
  try {
    emit('scan_text', { status: 'complete' });
    const violations = applyRules(input.caption, input.platform);
    const risk = riskFrom(violations, 0);
    const score = 100 - risk;
    const riskLevel = levelFromRisk(risk);
    emit('scoring', { status: 'complete', score, riskLevel });
    const bytes = new TextEncoder().encode(JSON.stringify({
      caption: input.caption, platform: input.platform,
      mediaType: 'none', mediaUrl: null,
    }));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const hashSha256 = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0')).join('');
    const warnings = [
      'Ce résultat utilise seulement les règles automatiques. Aucun modèle IA ne vérifie le texte.',
      'Le score est provisoire, pas une validation ou une certification juridique.',
    ];
    const analysisMode = 'rules_only' as const;
    const result: AnalysisResult = {
      score, riskLevel, violations, aiFlags: [], rewrite: null, hashSha256,
      verificationId: created.id, analysisMode, warnings,
    };
    const { error: updateError } = await admin.from('verifications')
      .update({
        ai_score: score, ai_risk_level: riskLevel, status: 'completed',
        completed_at: new Date().toISOString(),
        hash_sha256: hashSha256,
        ai_explanation: { violations, aiFlags: [], analysisMode, warnings,
          scoringVersion: 'rules-v1' },
      }).eq('id', created.id).eq('user_id', input.userId);
    if (updateError) throw new Error('Impossible de terminer le contrôle automatique.');
    return result;
  } catch (cause) {
    await admin.from('verifications').update({ status: 'failed' })
      .eq('id', created.id).eq('user_id', input.userId);
    throw cause;
  }
}
