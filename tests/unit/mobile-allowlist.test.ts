import { describe, expect, it } from 'vitest';
import {
  buildMentioncheckUrl,
  isAllowedMentioncheckUrl,
  normalizeBaseUrl,
} from '../../apps/mobile/src/security/allowed-web-url';

describe('mobile web allowlist', () => {
  it('normalizes only https origins', () => {
    expect(normalizeBaseUrl('https://mentioncheck.app/path')).toBe('https://mentioncheck.app');
    expect(normalizeBaseUrl('http://mentioncheck.app')).toBe('https://mentioncheck.app');
    expect(normalizeBaseUrl('invalid')).toBe('https://mentioncheck.app');
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
  });
});
