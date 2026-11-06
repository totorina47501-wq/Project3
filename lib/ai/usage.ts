import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { PROMPT_VERSION } from '@/lib/ai/prompts';
import type { ModelTelemetry } from '@/lib/ai/schemas';

// Le trigger SQL rattache le coût au propriétaire de la vérification.
// Les métriques sont bornées : aucun média, prompt ou transcription en clair.
export async function recordAiUsage(verificationId:string,stage:string,usage:ModelTelemetry,metrics:unknown) {
 const {error}=await createAdminSupabase().from('ai_analyses').insert({
  verification_id:verificationId,stage,model_used:usage.model,
  prompt_tokens:usage.promptTokens,completion_tokens:usage.completionTokens,
  latency_ms:usage.latencyMs,cost_usd:usage.estimatedCostUsd,
  raw_response:{version:PROMPT_VERSION,metrics},
 });
 if(error) throw new Error('Échec de journalisation IA.');
}
