const HTTPS_PROTOCOL = 'https:';

export const DEFAULT_MENTIONCHECK_BASE_URL = 'https://mentioncheck.app';

export const DEFAULT_ALLOWED_ORIGINS = [
  'https://mentioncheck.app',
  'https://mentioncheck-staging.toto-rina47501.workers.dev',
] as const;

export function normalizeBaseUrl(
  candidate: string | undefined,
  fallback = DEFAULT_MENTIONCHECK_BASE_URL,
): string {
  if (!candidate) return fallback;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== HTTPS_PROTOCOL) return fallback;
    return parsed.origin;
  } catch {
    return fallback;
  }
}

export function buildMentioncheckUrl(baseOrigin: string, path: string): string {
  return new URL(path, `${baseOrigin}/`).toString();
}

export function isAllowedMentioncheckUrl(
  target: string,
  allowedOrigins: readonly string[] = DEFAULT_ALLOWED_ORIGINS,
): boolean {
  try {
    const parsed = new URL(target);
    return parsed.protocol === HTTPS_PROTOCOL && allowedOrigins.includes(parsed.origin);
  } catch {
    return false;
  }
}
