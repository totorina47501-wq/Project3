import { describe, expect, it } from 'vitest';
import {
  buildMentioncheckUrl,
  isAllowedMentioncheckUrl,
  normalizeBaseUrl,
  getSafeExternalUrl,
} from '../../apps/mobile/src/security/allowed-web-url';

describe('mobile web allowlist', () => {
  it('normalizes only https origins', () => {
    expect(normalizeBaseUrl('https://mentioncheck.app/path')).toBe('https://mentioncheck.app');
    expect(normalizeBaseUrl('http://mentioncheck.app')).toBe('https://mentioncheck.app');
    expect(normalizeBaseUrl('invalid')).toBe('https://mentioncheck.app');
    expect(normalizeBaseUrl('https://evil.example.com/')).toBe('https://mentioncheck.app');
    expect(normalizeBaseUrl('https://user:pass@mentioncheck.app/')).toBe('https://mentioncheck.app');
  });

  it('builds absolute urls safely', () => {
    expect(buildMentioncheckUrl('https://mentioncheck.app', '/dashboard')).toBe(
      'https://mentioncheck.app/dashboard',
    );
  });

  it('accepts mentioncheck origins and rejects others', () => {
    expect(isAllowedMentioncheckUrl('https://mentioncheck.app/dashboard')).toBe(true);
    expect(
      isAllowedMentioncheckUrl('https://mentioncheck-staging.toto-rina47501.workers.dev/login'),
    ).toBe(true);
    expect(isAllowedMentioncheckUrl('https://evil.example.com/phishing')).toBe(false);
    expect(isAllowedMentioncheckUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedMentioncheckUrl('https://mentioncheck.app.evil.example/')).toBe(false);
    expect(isAllowedMentioncheckUrl('https://user:pass@mentioncheck.app/login')).toBe(false);
  });
  it('delegates only credential-free HTTPS links to the OS', () => {
    expect(getSafeExternalUrl('https://example.com/creator?a=1')).toBe('https://example.com/creator?a=1');
    expect(getSafeExternalUrl('javascript:alert(1)')).toBeNull();
    expect(getSafeExternalUrl('intent://launch#Intent;end')).toBeNull();
    expect(getSafeExternalUrl('file:///private/path')).toBeNull();
    expect(getSafeExternalUrl('https://user:secret@example.com')).toBeNull();
  });
});
