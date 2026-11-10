import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import {
  exchangeSocialOAuthCode,
  revokeSocialOAuthToken,
} from '@/lib/social/oauth/exchange';
import {
  socialOAuthProviders,
  type SocialOAuthProvider,
  type SocialOAuthRuntimeConfig,
} from '@/lib/social/oauth/providers';

const now = new Date('2026-11-10T12:00:00.000Z');
const config = (provider: SocialOAuthProvider): SocialOAuthRuntimeConfig => ({
  provider,
  clientId: 'offline-client',
  clientSecret: 'offline-secret',
  redirectUri: `https://local.test/api/social-accounts/oauth/callback/${provider}`,
  allowedOrigins: ['https://local.test'],
});

function response(data: unknown, status = 200) {
  return new Response(data === null ? null : JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Échange OAuth simulé hors ligne', () => {
  beforeEach(() => vi.restoreAllMocks());

  it.each([
    ['instagram', { access_token: 'ig-access', user_id: 12345 }],
    ['tiktok', { data: { access_token: 'tt-access', expires_in: 3600, open_id: 'tt-user' } }],
    ['youtube', { access_token: 'yt-access', expires_in: 3600 }],
    ['linkedin', { access_token: 'li-access', expires_in: 3600 }],
  ] as const)(
    'échange le code %s sans exposer de secret dans une URL',
    async (provider, tokenResponse) => {
      const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        expect(url).not.toContain('offline-secret');
        expect(url).not.toMatch(/[?&](?:access_token|token|client_secret)=/i);
        if (url === socialOAuthProviders[provider].tokenEndpoint) {
          expect(init?.method).toBe('POST');
          const body = new URLSearchParams(String(init?.body));
          expect(body.get('client_secret')).toBe('offline-secret');
          expect(body.get('code')).toBe('simulated-code');
          if (provider === 'youtube') {
            expect(body.get('code_verifier')).toBe('simulated-verifier');
          }
          return response(tokenResponse);
        }
        if (provider === 'youtube') {
          expect(url).toBe(
            'https://youtube.googleapis.com/youtube/v3/channels?part=id&mine=true',
          );
          expect(new Headers(init?.headers).get('authorization')?.endsWith('yt-access')).toBe(true);
          return response({ items: [{ id: 'UC_test_Channel' }] });
        }
        if (provider === 'linkedin') {
          expect(url).toBe('https://api.linkedin.com/v2/userinfo');
          expect(new Headers(init?.headers).get('authorization')?.endsWith('li-access')).toBe(true);
          return response({ sub: 'li-user' });
        }
        throw new Error('Unexpected simulated provider request.');
      });

      const result = await exchangeSocialOAuthCode({
        provider,
        config: config(provider),
        redirectUri: config(provider).redirectUri,
        authorizationCode: 'simulated-code',
        codeVerifier: provider === 'youtube' ? 'simulated-verifier' : null,
        fetcher: fetcher as typeof fetch,
        now,
      });
      expect(result.handle).toBe(provider === 'instagram' ? '12345' :
        provider === 'tiktok' ? 'tt-user' :
          provider === 'youtube' ? 'UC_test_Channel' : 'li-user');
      expect(result.expiresAt).toBe('2026-11-10T13:00:00.000Z');
      expect(result.tokenSecret).toContain(
        provider === 'instagram' ? 'ig-access' :
          provider === 'tiktok' ? 'tt-access' :
            provider === 'youtube' ? 'yt-access' : 'li-access',
      );
      expect(fetcher).toHaveBeenCalledTimes(provider === 'youtube' || provider === 'linkedin' ? 2 : 1);
    },
  );

  it('refuse les jetons mal formés et masque les erreurs du fournisseur', async () => {
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe(socialOAuthProviders.instagram.tokenEndpoint);
      expect(init?.method).toBe('POST');
      return response({
        access_token: 'simulated-secret',
        expires_in: 30,
        error_description: 'sensitive provider detail',
      });
    });
    await expect(exchangeSocialOAuthCode({
      provider: 'instagram',
      config: config('instagram'),
      redirectUri: config('instagram').redirectUri,
      authorizationCode: 'simulated-code',
      codeVerifier: null,
      fetcher: fetcher as typeof fetch,
      now,
    })).rejects.toThrow('OAuth provider request unavailable.');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('révoque au mieux un jeton non persistant si la recherche d’identité échoue', async () => {
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url === socialOAuthProviders.youtube.tokenEndpoint) {
        return response({ access_token: 'yt-orphan', expires_in: 3600 });
      }
      if (url.includes('/channels?')) return response(null, 503);
      expect(url).toBe(socialOAuthProviders.youtube.revocationEndpoint);
      expect(String(init?.body)).toContain('yt-orphan');
      expect(url).not.toContain('yt-orphan');
      return new Response(null, { status: 200 });
    });
    await expect(exchangeSocialOAuthCode({
      provider: 'youtube',
      config: config('youtube'),
      redirectUri: config('youtube').redirectUri,
      authorizationCode: 'simulated-code',
      codeVerifier: 'simulated-verifier',
      fetcher: fetcher as typeof fetch,
      now,
    })).rejects.toThrow('OAuth provider response unavailable.');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('révoque avec POST et n’envoie rien si le jeton est déjà expiré ou sans API', async () => {
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe(socialOAuthProviders.youtube.revocationEndpoint);
      expect(init?.method).toBe('POST');
      return new Response(null, { status: 200 });
    });
    const tokenSecret = JSON.stringify({
      accessToken: 'simulated-access',
      tokenType: 'Bearer',
      expiresAt: '2026-11-10T13:00:00.000Z',
    });
    await revokeSocialOAuthToken({
      provider: 'youtube',
      config: config('youtube'),
      tokenSecret,
      fetcher: fetcher as typeof fetch,
      now,
    });
    expect(String(fetcher.mock.calls[0]?.[0])).toBe(
      socialOAuthProviders.youtube.revocationEndpoint,
    );
    expect(String(fetcher.mock.calls[0]?.[1]?.body)).toContain('simulated-access');
    expect(String(fetcher.mock.calls[0]?.[0])).not.toContain('simulated-access');
    await revokeSocialOAuthToken({
      provider: 'youtube',
      config: config('youtube'),
      tokenSecret: JSON.stringify({ ...JSON.parse(tokenSecret), expiresAt: now.toISOString() }),
      fetcher: fetcher as typeof fetch,
      now,
    });
    await revokeSocialOAuthToken({
      provider: 'instagram',
      config: config('instagram'),
      tokenSecret,
      fetcher: fetcher as typeof fetch,
      now,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
