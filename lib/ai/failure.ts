// Classification des erreurs IA sans journaliser les prompts, les clés ni la légende.
export type AiFailureCategory =
  | 'authentication' | 'permission' | 'credit' | 'rate_limit'
  | 'request' | 'provider' | 'network' | 'unknown';
type Details = { status?: unknown; code?: unknown; name?: unknown };
export function classifyAiFailure(error: unknown): AiFailureCategory {
  if (!error || typeof error !== 'object') return 'unknown';
  const item = error as Details;
  const status = typeof item.status === 'number' ? item.status : null;
  const code = typeof item.code === 'string' ? item.code : '';
  const name = typeof item.name === 'string' ? item.name : '';
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
export function reportAiFailure(stage: 'text' | 'vision' | 'rewrite', error: unknown) {
  const status = error && typeof error === 'object' && 'status' in error
    && typeof error.status === 'number' ? error.status : undefined;
  console.error('[mentioncheck][ai_failure]', {
    stage, category: classifyAiFailure(error), status,
  });
}
