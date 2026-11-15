import { DEFAULT_ALLOWED_ORIGINS, getSafeExternalUrl, isAllowedMentioncheckUrl } from './allowed-web-url';

export const BLOCKED_LINK_NOTICE = 'Lien non securise bloque.';
export const OFFLINE_NOTICE = 'Connexion indisponible.';
export const WEBVIEW_MEDIA_PERMISSION_GRANT_TYPE = 'prompt' as const;

type WebViewNavigationDecision =
  | { type: 'allow' }
  | { type: 'external'; externalUrl: string; notice: string }
  | { type: 'block'; notice?: string };

export function evaluateWebViewNavigation(
  targetUrl: string | undefined,
  allowedOrigins: readonly string[] = DEFAULT_ALLOWED_ORIGINS,
): WebViewNavigationDecision {
  if (!targetUrl) {
    return { type: 'block' };
  }
  if (isAllowedMentioncheckUrl(targetUrl, allowedOrigins)) {
    return { type: 'allow' };
  }
  const externalUrl = getSafeExternalUrl(targetUrl);
  if (!externalUrl) {
    return { type: 'block', notice: BLOCKED_LINK_NOTICE };
  }
  return {
    type: 'external',
    externalUrl,
    notice: `Lien externe : ${new URL(externalUrl).hostname}`,
  };
}

export function shouldHandleHardwareBack(canGoBack: boolean): boolean {
  return canGoBack;
}
