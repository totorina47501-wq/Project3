// Classification des erreurs IA sans journaliser les prompts, les clés ni la légende.
import { logServerError } from '@/lib/security/logging';
export type AiFailureCategory =
  | 'missing_key' | 'authentication' | 'permission' | 'credit' | 'rate_limit'
  | 'request' | 'provider' | 'network' | 'disabled' | 'invalid_output' | 'unknown';
type Details = { status?: unknown; code?: unknown; name?: unknown; kind?: unknown };
const safeProviderCodes = new Set(['invalid_image_url','invalid_image_format','invalid_value',
  'invalid_request_error','model_not_found','context_length_exceeded','rate_limit_exceeded','insufficient_quota']);
export function aiFailureDetails(error: unknown) {
  const result: { category: AiFailureCategory; providerCode?: string; providerStatus?: number; outputKind?: string } = { category: classifyAiFailure(error) };
  if (!error || typeof error !== 'object') return result;
  const item = error as Details;
  if (typeof item.code === 'string' && safeProviderCodes.has(item.code)) result.providerCode = item.code;
  if (typeof item.status === 'number' && Number.isInteger(item.status) && item.status >= 400 && item.status <= 599) result.providerStatus = item.status;
  if (typeof item.kind === 'string' && ['invalid_json','schema_mismatch','empty','refusal','token_limit'].includes(item.kind)) result.outputKind = item.kind;
  return result;
}
export function classifyAiFailure(error: unknown): AiFailureCategory {
  if (!error || typeof error !== 'object') return 'unknown';
  const item = error as Details;
  const status = typeof item.status === 'number' && Number.isInteger(item.status) && item.status >= 400 && item.status <= 599 ? item.status : null;
  const code = typeof item.code === 'string' ? item.code : '';
  const name = typeof item.name === 'string' ? item.name : '';
  if (name === 'ModelOutputError') return 'invalid_output';
  if (name === 'MissingOpenAIKeyError') return 'missing_key';
  if (name === 'OpenAICapabilityDisabledError') return 'disabled';
  if (status === 401) return 'authentication';
  if (status === 403) return 'permission';
  if (/^(insufficient_quota|credit_balance_exhausted|organization_spend_limit_exceeded|project_spend_limit_exceeded|organization_usage_limit_exceeded|billing_hard_limit_reached)$/.test(code)) {
    return 'credit';
  }
  if (status === 429) return 'rate_limit';
  if (status === 400 || status === 404 || status === 422) return 'request';
  if (status !== null && status >= 500) return 'provider';
  if (name === 'APIConnectionError' || name === 'APITimeoutError') return 'network';
  return 'unknown';
}
export function reportAiFailure(stage: 'text' | 'vision' | 'rewrite' | 'transcription', error: unknown) {
  const status = error && typeof error === 'object' && 'status' in error
    && typeof error.status === 'number' ? error.status : undefined;
  logServerError('ai_failure', error, {
    stage, category: classifyAiFailure(error), status,
  });
}
