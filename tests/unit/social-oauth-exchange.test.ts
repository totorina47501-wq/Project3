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
        expect(init?.redirect).toBe('manual');
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
    })).rejects.toMatchObject({
      stage: 'token',
      message: 'OAuth provider request unavailable.',
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each(['invalid_client', 'invalid_grant', 'redirect_uri_mismatch', 'invalid_request'] as const)(
    'classe le rejet du jeton Google %s sans révéler la réponse fournisseur',
    async (code) => {
      const fetcher = vi.fn(async () => response({
        error: code,
        error_description: 'INTERNAL_GOOGLE_DETAILS_MUST_STAY_PRIVATE',
      }, 400));
      await expect(exchangeSocialOAuthCode({
        provider: 'youtube',
        config: config('youtube'),
        redirectUri: config('youtube').redirectUri,
        authorizationCode: 'simulated-code',
        codeVerifier: 'simulated-verifier',
        fetcher: fetcher as typeof fetch,
        now,
      })).rejects.toMatchObject({
        stage: 'token',
        reason: code,
        message: 'OAuth provider request unavailable.',
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    ['empty', { items: [] }, 200],
    ['signup-required', { error: { errors: [{ reason: 'youtubeSignupRequired' }] } }, 401],
  ] as const)(
    'détecte une chaîne YouTube absente (%s) sans conserver de jeton',
    async (_caseName, channelBody, channelStatus) => {
      const fetcher = vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url === socialOAuthProviders.youtube.tokenEndpoint) {
          return response({ access_token: 'offline-yt-token', expires_in: 3600 });
        }
        if (url.includes('/channels?')) return response(channelBody, channelStatus);
        if (url === socialOAuthProviders.youtube.revocationEndpoint) {
          return new Response(null, { status: 200 });
        }
        throw new Error('Unexpected provider request');
      });
      await expect(exchangeSocialOAuthCode({
        provider: 'youtube',
        config: config('youtube'),
        redirectUri: config('youtube').redirectUri,
        authorizationCode: 'offline-code',
        codeVerifier: 'offline-verifier',
        fetcher: fetcher as typeof fetch,
        now,
      })).rejects.toMatchObject({
        stage: 'channel',
        reason: 'no_channel',
        message: 'OAuth provider response unavailable.',
      });
      expect(fetcher).toHaveBeenCalledTimes(3);
    },
  );

  it.each([
    ['instagram', { access_token: 'ig-token', expires_in: 3600 }, null],
    ['tiktok', { data: { access_token: 'tt-token', expires_in: 3600 } }, null],
    ['linkedin', { access_token: 'li-token', expires_in: 3600 }, {}],
  ] as const)(
    'classe un profil %s absent sans inférer un compte inexistant',
    async (provider, tokenData, profileData) => {
      const fetcher = vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url === socialOAuthProviders[provider].tokenEndpoint) return response(tokenData);
        if (provider === 'linkedin' && url === 'https://api.linkedin.com/v2/userinfo') return response(profileData);
        if (url === socialOAuthProviders.tiktok.revocationEndpoint) return new Response(null, { status: 200 });
        throw new Error('Unexpected provider request');
      });
      await expect(exchangeSocialOAuthCode({
        provider,
        config: config(provider),
        redirectUri: config(provider).redirectUri,
        authorizationCode: 'offline-code',
        codeVerifier: null,
        fetcher: fetcher as typeof fetch,
        now,
      })).rejects.toMatchObject({
        stage: 'channel',
        reason: 'profile_unavailable',
      });
    },
  );

  it('ne confond pas une API YouTube indisponible avec une chaîne absente', async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url === socialOAuthProviders.youtube.tokenEndpoint) {
        return response({ access_token: 'yt-token', expires_in: 3600 });
      }
      if (url.includes('/channels?')) return response({ error: { errors: [{ reason: 'quotaExceeded' }] } }, 403);
      if (url === socialOAuthProviders.youtube.revocationEndpoint) return new Response(null, { status: 200 });
      throw new Error('Unexpected provider request');
    });
    await expect(exchangeSocialOAuthCode({
      provider: 'youtube',
      config: config('youtube'),
      redirectUri: config('youtube').redirectUri,
      authorizationCode: 'offline-code',
      codeVerifier: 'offline-verifier',
      fetcher: fetcher as typeof fetch,
      now,
    })).rejects.toMatchObject({ stage: 'channel', reason: undefined });
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
    })).rejects.toMatchObject({
      stage: 'channel',
      message: 'OAuth provider response unavailable.',
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('ne suit pas les redirections fournisseur pour le jeton ni pour la révocation', async () => {
    const tokenFetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.redirect).toBe('manual');
      return new Response(null, {
        status: 302,
        headers: { Location: 'https://redirect.invalid/steal' },
      });
    });
    await expect(exchangeSocialOAuthCode({
      provider: 'youtube',
      config: config('youtube'),
      redirectUri: config('youtube').redirectUri,
      authorizationCode: 'simulated-code',
      codeVerifier: 'simulated-verifier',
      fetcher: tokenFetcher as typeof fetch,
      now,
    })).rejects.toMatchObject({
      stage: 'token',
      message: 'OAuth provider request unavailable.',
    });
    expect(tokenFetcher).toHaveBeenCalledTimes(1);

    const revokeFetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.redirect).toBe('manual');
      return new Response(null, {
        status: 302,
        headers: { Location: 'https://redirect.invalid/steal' },
      });
    });
    await expect(revokeSocialOAuthToken({
      provider: 'youtube',
      config: config('youtube'),
      tokenSecret: JSON.stringify({
        accessToken: 'fake-access-token',
        expiresAt: '2026-11-10T13:00:00.000Z',
      }),
      fetcher: revokeFetcher as typeof fetch,
      now,
    })).rejects.toThrow('OAuth provider request unavailable.');
    expect(revokeFetcher).toHaveBeenCalledTimes(1);
  });

  it('révoque avec POST mais ne confirme pas un jeton expiré sans appel fournisseur', async () => {
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe(socialOAuthProviders.youtube.revocationEndpoint);
      expect(init?.method).toBe('POST');
      expect(init?.redirect).toBe('manual');
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
    await expect(revokeSocialOAuthToken({
      provider: 'youtube',
      config: config('youtube'),
      tokenSecret: JSON.stringify({ ...JSON.parse(tokenSecret), expiresAt: now.toISOString() }),
      fetcher: fetcher as typeof fetch,
      now,
    })).rejects.toThrow('OAuth provider revocation unconfirmed.');
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
