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
    // Le paramètre EXPO_PUBLIC_ ne doit jamais élargir les domaines de confiance.
    if (
      parsed.protocol !== HTTPS_PROTOCOL ||
      parsed.username ||
      parsed.password ||
      !DEFAULT_ALLOWED_ORIGINS.some((origin) => origin === parsed.origin)
    ) {
      return fallback;
    }
    return parsed.origin;
  } catch {
    return fallback;
  }
}

export function buildMentioncheckUrl(baseOrigin: string, path: string): string {
  return new URL(path, `${normalizeBaseUrl(baseOrigin)}/`).toString();
}

export function isAllowedMentioncheckUrl(
  target: string,
  allowedOrigins: readonly string[] = DEFAULT_ALLOWED_ORIGINS,
): boolean {
  try {
    const parsed = new URL(target);
    return (
      parsed.protocol === HTTPS_PROTOCOL &&
      !parsed.username &&
      !parsed.password &&
      allowedOrigins.some((origin) => DEFAULT_ALLOWED_ORIGINS.includes(origin as typeof DEFAULT_ALLOWED_ORIGINS[number]) && origin === parsed.origin)
    );
  } catch {
    return false;
  }
}

// Une WebView ne doit jamais déléguer javascript:, intent:, file:, data: ou un lien avec identifiants à l'OS.
export function getSafeExternalUrl(target: string): string | null {
  try {
    const parsed = new URL(target);
    if (parsed.protocol !== HTTPS_PROTOCOL || parsed.username || parsed.password) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}
