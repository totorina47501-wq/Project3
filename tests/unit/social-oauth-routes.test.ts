import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => {
  const transactions: Array<Record<string, unknown>> = [];
  return {
    requireUser: vi.fn(),
    requireSession: vi.fn(),
    exchange: vi.fn(),
    revoke: vi.fn(),
    save: vi.fn(),
    readCredential: vi.fn(),
    disconnect: vi.fn(),
    transactions,
    transactionStore: {
      create: vi.fn(async (transaction: Record<string, unknown>) => {
        transactions.push(transaction);
      }),
      consume: vi.fn(async (input: Record<string, unknown>) => {
        const index = transactions.findIndex((transaction) =>
          ['userId', 'sessionId', 'provider', 'stateHash'].every(
            (key) => transaction[key] === input[key],
          ),
        );
        if (index < 0) return null;
        return transactions.splice(index, 1)[0] as never;
      }),
    },
  };
});

vi.mock('@/lib/security/auth', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/security/auth')>(),
  requireUser: mocks.requireUser,
}));
vi.mock('@/lib/social/oauth/session', () => ({
  requireSocialOAuthSession: mocks.requireSession,
}));
vi.mock('@/lib/social/oauth/store', () => ({
  createSocialOAuthTransactionStore: () => mocks.transactionStore,
}));
vi.mock('@/lib/social/oauth/accounts', () => ({
  createSocialOAuthAccountStore: () => ({
    save: mocks.save,
    readCredential: mocks.readCredential,
    disconnect: mocks.disconnect,
  }),
}));
vi.mock('@/lib/social/oauth/exchange', () => ({
  exchangeSocialOAuthCode: mocks.exchange,
  revokeSocialOAuthToken: mocks.revoke,
  OAuthProviderStageError: class extends Error {
    constructor(
      public readonly stage: 'token' | 'channel',
      message: string,
      public readonly reason?: 'invalid_client' | 'invalid_grant' | 'redirect_uri_mismatch' | 'invalid_request' | 'no_channel' | 'profile_unavailable',
    ) {
      super(message);
    }
  },
}));

import { OAuthProviderStageError } from '@/lib/social/oauth/exchange';
import { GET as listProviders } from '@/app/api/social-accounts/oauth/providers/route';
import { POST as startOAuth } from '@/app/api/social-accounts/oauth/start/route';
import { GET as callbackOAuth } from '@/app/api/social-accounts/oauth/callback/[provider]/route';
import { POST as disconnectOAuth } from '@/app/api/social-accounts/oauth/disconnect/[id]/route';

const userId = '20000000-0000-0000-0000-000000000001';
const sessionId = '30000000-0000-0000-0000-000000000001';
const accountId = '40000000-0000-4000-8000-000000000001';
const callbackPath = 'https://local.test/api/social-accounts/oauth/callback/youtube';

function enableYouTube() {
  vi.stubEnv('SOCIAL_OAUTH_ENABLED', 'true');
  vi.stubEnv('SOCIAL_OAUTH_YOUTUBE_ENABLED', 'true');
  vi.stubEnv('SOCIAL_OAUTH_YOUTUBE_CLIENT_ID', 'offline-client');
  vi.stubEnv('SOCIAL_OAUTH_YOUTUBE_CLIENT_SECRET', 'offline-secret');
  vi.stubEnv('SOCIAL_OAUTH_PUBLIC_ORIGIN', 'https://local.test');
  vi.stubEnv('SOCIAL_OAUTH_ALLOWED_ORIGINS', 'https://local.test');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  mocks.transactions.splice(0);
  mocks.requireUser.mockResolvedValue({
    user: { id: userId },
    client: { rpc: vi.fn().mockResolvedValue({ error: null }) },
  });
  mocks.requireSession.mockResolvedValue({
    user: { id: userId },
    sessionId,
    client: {},
  });
  mocks.exchange.mockResolvedValue({
    handle: 'uc_channel',
    tokenSecret: '{"accessToken":"simulated-access"}',
    expiresAt: '2026-11-10T13:00:00.000Z',
  });
  mocks.save.mockResolvedValue(accountId);
});

describe('Routes OAuth sociales', () => {
  it('n’affiche aucun fournisseur avant activation explicite', async () => {
    const response = await listProviders();
    expect(await response.json()).toEqual({
      providers: { instagram: false, tiktok: false, youtube: false, linkedin: false },
    });
  });

  it('refuse le démarrage sans activation globale et propre au fournisseur', async () => {
    const response = await startOAuth(new Request(
      'https://local.test/api/social-accounts/oauth/start',
      {
        method: 'POST',
        headers: { Origin: 'https://local.test', 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'youtube' }),
      },
    ));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('offline-secret');
    expect(mocks.transactions).toHaveLength(0);
  });

  it('protège le démarrage contre le CSRF et réalise un callback simulé une seule fois', async () => {
    enableYouTube();
    const foreign = await startOAuth(new Request(
      'https://local.test/api/social-accounts/oauth/start',
      {
        method: 'POST',
        headers: { Origin: 'https://attacker.invalid', 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'youtube' }),
      },
    ));
    expect(foreign.status).toBe(403);
    expect(mocks.transactions).toHaveLength(0);

    const invalidHost = await callbackOAuth(
      new Request('https://attacker.invalid/api/social-accounts/oauth/callback/youtube'),
      { params: Promise.resolve({ provider: 'youtube' }) },
    );
    expect(invalidHost.status).toBe(303);
    expect(invalidHost.headers.get('location')).toMatch(/^https:\/\/local\.test\//);

    const enabled = await listProviders();
    expect(await enabled.json()).toMatchObject({
      providers: { youtube: true, instagram: false, tiktok: false, linkedin: false },
    });
    const started = await startOAuth(new Request(
      'https://local.test/api/social-accounts/oauth/start',
      {
        method: 'POST',
        headers: { Origin: 'https://local.test', 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'youtube' }),
      },
    ));
    const startBody = await started.json() as { authorizationUrl: string };
    const authorization = new URL(startBody.authorizationUrl);
    const state = authorization.searchParams.get('state');
    expect(state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(authorization.searchParams.get('code_challenge_method')).toBe('S256');

    const callback = new URL(callbackPath);
    callback.searchParams.set('code', 'simulated-code');
    callback.searchParams.set('state', state!);
    const completed = await callbackOAuth(
      new Request(callback),
      { params: Promise.resolve({ provider: 'youtube' }) },
    );
    expect(completed.status).toBe(303);
    expect(completed.headers.get('cache-control')).toBe('private, no-store');
    expect(completed.headers.get('referrer-policy')).toBe('no-referrer');
    expect(completed.headers.get('location')).toContain('social_oauth=connected');
    expect(completed.headers.get('location')).not.toContain('simulated-code');
    expect(mocks.exchange).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'youtube',
      authorizationCode: 'simulated-code',
      codeVerifier: expect.any(String),
    }));
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({
      userId,
      provider: 'youtube',
      handle: 'uc_channel',
    }));
    expect(mocks.transactions).toHaveLength(0);

    mocks.save.mockRejectedValueOnce(new Error('Vault internal detail'));
    const retryStart = await startOAuth(new Request(
      'https://local.test/api/social-accounts/oauth/start',
      {
        method: 'POST',
        headers: { Origin: 'https://local.test', 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'youtube' }),
      },
    ));
    const retryAuthorization = new URL(
      (await retryStart.json() as { authorizationUrl: string }).authorizationUrl,
    );
    const retryCallback = new URL(callbackPath);
    retryCallback.searchParams.set('code', 'simulated-code');
    retryCallback.searchParams.set('state', retryAuthorization.searchParams.get('state')!);
    const failedPersistence = await callbackOAuth(
      new Request(retryCallback),
      { params: Promise.resolve({ provider: 'youtube' }) },
    );
    expect(failedPersistence.headers.get('location')).toContain('social_oauth=unavailable');
    expect(failedPersistence.headers.get('location')).not.toContain('Vault internal detail');
    expect(mocks.revoke).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'youtube',
      tokenSecret: expect.stringContaining('simulated-access'),
    }));
  });

  it('redirige avec une catégorie sûre après échec de récupération de chaîne Google', async () => {
    enableYouTube();
    const started = await startOAuth(new Request(
      'https://local.test/api/social-accounts/oauth/start',
      {
        method: 'POST',
        headers: { Origin: 'https://local.test', 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'youtube' }),
      },
    ));
    const authorization = new URL(
      (await started.json() as { authorizationUrl: string }).authorizationUrl,
    );
    const url = new URL(callbackPath);
    url.searchParams.set('code', 'temporary-code');
    url.searchParams.set('state', authorization.searchParams.get('state')!);
    mocks.exchange.mockRejectedValueOnce(
      new OAuthProviderStageError('channel', 'OAuth provider response unavailable.'),
    );
    const result = await callbackOAuth(
      new Request(url),
      { params: Promise.resolve({ provider: 'youtube' }) },
    );
    expect(result.status).toBe(303);
    expect(result.headers.get('location')).toContain('social_oauth=unavailable');
    expect(result.headers.get('location')).toContain('social_oauth_error=channel');
    expect(result.headers.get('location')).not.toContain('temporary-code');
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it.each(['no_channel', 'profile_unavailable'] as const)(
    'redirige après un échec de profil %s sans enregistrer le compte',
    async (reason) => {
      enableYouTube();
      const started = await startOAuth(new Request('https://local.test/api/social-accounts/oauth/start', {
        method: 'POST',
        headers: { Origin: 'https://local.test', 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'youtube' }),
      }));
      const authorization = new URL((await started.json() as { authorizationUrl: string }).authorizationUrl);
      const callback = new URL(callbackPath);
      callback.searchParams.set('code', 'offline-secret-code');
      callback.searchParams.set('state', authorization.searchParams.get('state')!);
      mocks.exchange.mockRejectedValueOnce(new OAuthProviderStageError(
        'channel', 'OAuth provider response unavailable.', reason,
      ));
      const result = await callbackOAuth(new Request(callback), {
        params: Promise.resolve({ provider: 'youtube' }),
      });
      const location = result.headers.get('location') ?? '';
      expect(location).toContain('social_oauth_error=channel');
      expect(location).toContain('social_oauth_reason=' + reason);
      expect(location).not.toContain('offline-secret-code');
      expect(mocks.save).not.toHaveBeenCalled();
    },
  );

  it('redirige avec un code OAuth Google autorisé sans exposer le code de connexion', async () => {
    enableYouTube();
    const started = await startOAuth(new Request('https://local.test/api/social-accounts/oauth/start', {
      method: 'POST',
      headers: { Origin: 'https://local.test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'youtube' }),
    }));
    const destination = new URL(
      (await started.json() as { authorizationUrl: string }).authorizationUrl,
    );
    const callback = new URL(callbackPath);
    callback.searchParams.set('state', destination.searchParams.get('state')!);
    callback.searchParams.set('code', 'SIMULATED_GOOGLE_SECRET_CODE');
    mocks.exchange.mockRejectedValueOnce(
      new OAuthProviderStageError('token', 'OAuth provider request unavailable.', 'invalid_client'),
    );
    const result = await callbackOAuth(
      new Request(callback),
      { params: Promise.resolve({ provider: 'youtube' }) },
    );
    const location = result.headers.get('location') ?? '';
    expect(location).toContain('social_oauth_error=token');
    expect(location).toContain('social_oauth_reason=invalid_client');
    expect(location).not.toContain('SIMULATED_GOOGLE_SECRET_CODE');
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('déconnecte selon le propriétaire, masque le secret et confirme la révocation simulée', async () => {
    enableYouTube();
    mocks.readCredential.mockResolvedValue({
      provider: 'youtube',
      tokenSecret: '{"accessToken":"simulated-access"}',
    });
    mocks.revoke.mockResolvedValue(undefined);
    const response = await disconnectOAuth(
      new Request(`https://local.test/api/social-accounts/oauth/disconnect/${accountId}`, {
        method: 'POST',
        headers: { Origin: 'https://local.test' },
      }),
      { params: Promise.resolve({ id: accountId }) },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ disconnected: true, revocation: 'confirmed' });
    expect(mocks.readCredential).toHaveBeenCalledWith({ userId, accountId });
    expect(mocks.disconnect).toHaveBeenCalledWith({ userId, accountId });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
});
