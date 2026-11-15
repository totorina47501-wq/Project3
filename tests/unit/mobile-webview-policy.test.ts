import { describe, expect, it } from 'vitest';
import {
  BLOCKED_LINK_NOTICE,
  OFFLINE_NOTICE,
  WEBVIEW_MEDIA_PERMISSION_GRANT_TYPE,
  evaluateWebViewNavigation,
  shouldHandleHardwareBack,
} from '../../apps/mobile/src/security/webview-policy';

describe('mobile webview policy', () => {
  it('authorizes mentioncheck auth deep links in webview', () => {
    expect(
      evaluateWebViewNavigation('https://mentioncheck.app/auth/callback?code=abc&state=xyz'),
    ).toEqual({ type: 'allow' });
    expect(
      evaluateWebViewNavigation(
        'https://mentioncheck-staging.toto-rina47501.workers.dev/auth/callback?code=abc',
      ),
    ).toEqual({ type: 'allow' });
  });

  it('keeps android back handling tied to webview history', () => {
    expect(shouldHandleHardwareBack(true)).toBe(true);
    expect(shouldHandleHardwareBack(false)).toBe(false);
  });

  it('delegates only safe external https links to os browser', () => {
    expect(evaluateWebViewNavigation('https://docs.example.com/rules')).toEqual({
      type: 'external',
      externalUrl: 'https://docs.example.com/rules',
      notice: 'Lien externe : docs.example.com',
    });
  });

  it('blocks non-https or malformed navigation attempts', () => {
    expect(evaluateWebViewNavigation('javascript:alert(1)')).toEqual({
      type: 'block',
      notice: BLOCKED_LINK_NOTICE,
    });
    expect(evaluateWebViewNavigation(undefined)).toEqual({ type: 'block' });
  });

  it('uses explicit webview permission and offline policies', () => {
    expect(WEBVIEW_MEDIA_PERMISSION_GRANT_TYPE).toBe('prompt');
    expect(OFFLINE_NOTICE).toBe('Connexion indisponible.');
  });
});
