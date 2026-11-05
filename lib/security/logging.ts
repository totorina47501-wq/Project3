// Journaux opérationnels uniquement : aucun texte libre, identifiant, email,
// jeton, message SDK, stack ou cause d'erreur ne franchit cette frontière.
const categories = new Set([
  'missing_runtime_config', 'invalid_credentials', 'rate_limited', 'provider_unavailable',
  'configuration_error', 'unknown', 'missing_key', 'authentication', 'permission',
  'credit', 'rate_limit', 'request', 'provider', 'network', 'disabled', 'invalid_output',
]);
const errorTypes = new Set([
  'Error', 'TypeError', 'SyntaxError', 'HttpError', 'AbortError',
  'AuthApiError', 'AuthRetryableFetchError', 'APIConnectionError', 'APITimeoutError',
  'MissingOpenAIKeyError', 'OpenAICapabilityDisabledError', 'ModelOutputError',
]);
const configNames = new Set(['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']);

export function sanitizeLogContext(input: unknown): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (!input || typeof input !== 'object') return result;
  // Lire seulement des valeurs propres : les accesseurs ne sont pas exécutés.
  for (const key of ['category', 'stage', 'status', 'providerStatus', 'runtimeUrlPresent', 'runtimeKeyPresent', 'missingVariables']) {
    const value = Object.getOwnPropertyDescriptor(input, key)?.value;
    if (key === 'category' && typeof value === 'string' && categories.has(value)) result[key] = value;
    if (key === 'stage' && ['text', 'vision', 'rewrite'].includes(value)) result[key] = value;
    if ((key === 'status' || key === 'providerStatus') && Number.isInteger(value) && value >= 100 && value <= 599) result[key] = value;
    if ((key === 'runtimeUrlPresent' || key === 'runtimeKeyPresent') && typeof value === 'boolean') result[key] = value;
    if (key === 'missingVariables' && Array.isArray(value)) {
      result[key] = [...new Set(value.filter((name): name is string => typeof name === 'string' && configNames.has(name)))];
    }
  }
  return result;
}

export function logServerError(event: string, error: unknown, context?: unknown): void {
  let errorType = 'unknown';
  try {
    if (error && typeof error === 'object' && 'name' in error &&
        typeof error.name === 'string' && errorTypes.has(error.name)) errorType = error.name;
  } catch { /* Un accesseur d'erreur hostile ne doit pas casser la réponse. */ }
  const safeEvent = /^[a-z][a-z0-9_]{0,63}$/.test(event) ? event : 'invalid_event';
  console.error(`[mentioncheck][${safeEvent}]`, { errorType, ...sanitizeLogContext(context) });
}
