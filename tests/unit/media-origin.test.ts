import { describe, it, expect } from 'vitest';
import { isSameOrigin } from '../../lib/security/origin';

describe('Protection CSRF des écritures médias', () => {
  const endpoint = 'https://mentioncheck.test/api/media/remove';
  it('autorise la même origine explicite', () => {
    expect(isSameOrigin(new Request(endpoint, {
      headers: { origin: 'https://mentioncheck.test' },
    }))).toBe(true);
  });
  it('rejette une origine tierce', () => {
    expect(isSameOrigin(new Request(endpoint, {
      headers: { origin: 'https://elsewhere.test' },
    }))).toBe(false);
  });
  it('rejette les requêtes sans Origin et les origines opaques', () => {
    expect(isSameOrigin(new Request(endpoint))).toBe(false);
    expect(isSameOrigin(new Request(endpoint, {
      headers: { origin: 'null' },
    }))).toBe(false);
  });
  it('rejette les origines malformées et les URL qui contiennent un chemin', () => {
    expect(isSameOrigin(new Request(endpoint, {
      headers: { origin: 'not-an-origin' },
    }))).toBe(false);
    expect(isSameOrigin(new Request(endpoint, {
      headers: { origin: 'https://mentioncheck.test/attacker' },
    }))).toBe(false);
  });
  it('rejette un schéma ou un port différent', () => {
    expect(isSameOrigin(new Request(endpoint, {
      headers: { origin: 'http://mentioncheck.test' },
    }))).toBe(false);
    expect(isSameOrigin(new Request(endpoint, {
      headers: { origin: 'https://mentioncheck.test:444' },
    }))).toBe(false);
  });
  it('rejette une origine avec identifiants ou un fragment', () => {
    expect(isSameOrigin(new Request(endpoint, {
      headers: { origin: 'https://user:pass@mentioncheck.test' },
    }))).toBe(false);
    expect(isSameOrigin(new Request(endpoint, {
      headers: { origin: 'https://mentioncheck.test/#fragment' },
    }))).toBe(false);
  });
  it('rejette les origines de sous-domaines proches', () => {
    expect(isSameOrigin(new Request(endpoint, {
      headers: { origin: 'https://mentioncheck.test.evil.example' },
    }))).toBe(false);
    expect(isSameOrigin(new Request(endpoint, {
      headers: { origin: 'https://sub.mentioncheck.test' },
    }))).toBe(false);
  });

});
