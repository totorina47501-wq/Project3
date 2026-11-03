// Diagnostic sans valeurs de configuration, adresses email ni mots de passe.
export function missingAuthConfig(config: {
  supabaseUrl?: string; supabaseKey?: string;
}): string[] {
  const missing: string[] = [];
  if (!config.supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!config.supabaseKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  return missing;
}
export type AuthErrorCategory =
  'invalid_credentials' | 'rate_limited' | 'provider_unavailable' | 'configuration_error' | 'unknown';
export function categorizeAuthError(error: unknown): AuthErrorCategory {
  if (!error || typeof error !== 'object') return 'unknown';
  const record = error as { status?: unknown; code?: unknown; name?: unknown };
  const code = typeof record.code === 'string' ? record.code : '';
  const status = typeof record.status === 'number' ? record.status : null;
  const name = typeof record.name === 'string' ? record.name : '';
  if (code === 'invalid_credentials' || code === 'email_not_confirmed' ||
      code === 'invalid_grant') return 'invalid_credentials';
  if (status === 429 || code === 'over_email_send_rate_limit' ||
      code === 'over_request_rate_limit') return 'rate_limited';
  if (status !== null && status >= 500) return 'provider_unavailable';
  if (name === 'TypeError' || name === 'Error') return 'configuration_error';
  return 'unknown';
}
