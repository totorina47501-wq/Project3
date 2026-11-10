import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import {
  beginSocialOAuth,
  completeSocialOAuthCallback,
  oauthValueHash,
  SocialOAuthError,
  SOCIAL_OAUTH_STATE_TTL_SECONDS,
  type OAuthTransaction,
  type OAuthTransactionStore,
} from '@/lib/social/oauth/protocol';
import {
  socialOAuthConfig,
  socialOAuthProviders,
  type SocialOAuthProvider,
} from '@/lib/social/oauth/providers';

const owner = '20000000-0000-0000-0000-000000000001';
const other = '20000000-0000-0000-0000-000000000002';
const session = '30000000-0000-0000-0000-000000000001';
const otherSession = '30000000-0000-0000-0000-000000000002';
const now = new Date('2026-11-10T12:00:00.000Z');
const config = (provider: SocialOAuthProvider) => ({
  provider,
  clientId: 'offline-client',
  clientSecret: 'offline-secret',
  redirectUri: `https://local.test/api/social-accounts/oauth/callback/${provider}`,
  allowedOrigins: ['https://local.test'],
});

class MemoryOAuthStore implements OAuthTransactionStore {
  readonly transactions: OAuthTransaction[] = [];

  async create(transaction: OAuthTransaction) {
    this.transactions.push(transaction);
  }

  async consume(input: {
    userId: string;
    sessionId: string;
    provider: SocialOAuthProvider;
    stateHash: string;
  }) {
    const index = this.transactions.findIndex(
      (transaction) =>
        transaction.userId === input.userId &&
        transaction.sessionId === input.sessionId &&
        transaction.provider === input.provider &&
        transaction.stateHash === input.stateHash &&
        Date.parse(transaction.expiresAt) > now.getTime(),
    );
    if (index < 0) return null;
    return this.transactions.splice(index, 1)[0] ?? null;
  }
}

let store: MemoryOAuthStore;
beforeEach(() => {
  store = new MemoryOAuthStore();
});

describe('Socle OAuth social désactivé', () => {
  it('reste non configuré sans activation et sans tous les secrets serveur', () => {
    expect(socialOAuthConfig('instagram', {})).toBeNull();
    expect(
      socialOAuthConfig('instagram', {
        SOCIAL_OAUTH_ENABLED: 'true',
        SOCIAL_OAUTH_INSTAGRAM_ENABLED: 'true',
        SOCIAL_OAUTH_INSTAGRAM_CLIENT_ID: 'client',
        SOCIAL_OAUTH_PUBLIC_ORIGIN: 'https://local.test',
        SOCIAL_OAUTH_ALLOWED_ORIGINS: 'https://local.test',
      }),
    ).toBeNull();
    expect(
      socialOAuthConfig('instagram', {
        SOCIAL_OAUTH_ENABLED: 'true',
        SOCIAL_OAUTH_INSTAGRAM_ENABLED: 'true',
        SOCIAL_OAUTH_INSTAGRAM_CLIENT_ID: 'client',
        SOCIAL_OAUTH_INSTAGRAM_CLIENT_SECRET: 'server-secret',
        SOCIAL_OAUTH_PUBLIC_ORIGIN: 'https://local.test',
        SOCIAL_OAUTH_ALLOWED_ORIGINS: 'https://local.test',
      }),
    ).toMatchObject({
      clientSecret: 'server-secret',
      redirectUri: 'https://local.test/api/social-accounts/oauth/callback/instagram',
    });
    expect(socialOAuthConfig('instagram', {
      SOCIAL_OAUTH_ENABLED: 'true',
      SOCIAL_OAUTH_INSTAGRAM_CLIENT_ID: 'client',
      SOCIAL_OAUTH_INSTAGRAM_CLIENT_SECRET: 'server-secret',
      SOCIAL_OAUTH_PUBLIC_ORIGIN: 'https://local.test',
      SOCIAL_OAUTH_ALLOWED_ORIGINS: 'https://local.test',
    })).toBeNull();
  });

  it('déclare quatre adaptateurs distincts avec des scopes sans publication', () => {
    expect(socialOAuthProviders.instagram.authorizationEndpoint).toContain('instagram.com');
    expect(socialOAuthProviders.tiktok.clientIdParameter).toBe('client_key');
    expect(socialOAuthProviders.youtube.pkce).toBe(true);
    expect(socialOAuthProviders.linkedin.scopes).toEqual(['openid', 'profile']);
    for (const provider of Object.values(socialOAuthProviders)) {
      expect(provider.scopes.join(' ')).not.toMatch(/publish|write|message|email/i);
    }
  });

  it('refuse une origine non HTTPS ou non allowlistée avant de créer un état', async () => {
    const env = {
      SOCIAL_OAUTH_ENABLED: 'true',
      SOCIAL_OAUTH_INSTAGRAM_ENABLED: 'true',
      SOCIAL_OAUTH_INSTAGRAM_CLIENT_ID: 'client',
      SOCIAL_OAUTH_INSTAGRAM_CLIENT_SECRET: 'server-secret',
      SOCIAL_OAUTH_PUBLIC_ORIGIN: 'https://other.test',
      SOCIAL_OAUTH_ALLOWED_ORIGINS: 'https://local.test',
    };
    expect(socialOAuthConfig('instagram', env)).toBeNull();
    await expect(
      beginSocialOAuth({
        provider: 'instagram',
        userId: owner,
        sessionId: session,
        store,
        config: { ...config('instagram'), redirectUri: 'https://evil.test/callback' },
        now,
      }),
    ).rejects.toBeInstanceOf(SocialOAuthError);
    expect(store.transactions).toHaveLength(0);
  });

  it('binds state to the owner/session, stores only its hash, applies PKCE, expiry and anti-replay', async () => {
    const authorizationUrl = await beginSocialOAuth({
      provider: 'youtube',
      userId: owner,
      sessionId: session,
      store,
      config: config('youtube'),
      now,
    });
    const state = authorizationUrl.searchParams.get('state')!;
    const transaction = store.transactions[0]!;
    const instagramUrl = await beginSocialOAuth({
      provider: 'instagram',
      userId: owner,
      sessionId: session,
      store,
      config: config('instagram'),
      now,
    });
    expect(authorizationUrl.searchParams.get('code_challenge_method')).toBe('S256');
    expect(authorizationUrl.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(instagramUrl.searchParams.has('code_challenge')).toBe(false);
    expect(transaction.userId).toBe(owner);
    expect(transaction.sessionId).toBe(session);
    expect(transaction.stateHash).toBe(await oauthValueHash(state));
    expect(transaction.stateHash).not.toBe(state);
    expect(Date.parse(transaction.expiresAt) - now.getTime()).toBe(
      SOCIAL_OAUTH_STATE_TTL_SECONDS * 1000,
    );
    expect(transaction.pkceVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(authorizationUrl.searchParams.get('scope')).toBe(
      'https://www.googleapis.com/auth/youtube.readonly',
    );

    const callbackUrl = `${config('youtube').redirectUri}?code=simulated-code&state=${state}&scope=${encodeURIComponent('https://www.googleapis.com/auth/youtube.readonly')}`;
    await expect(
      completeSocialOAuthCallback({
        provider: 'youtube',
        userId: other,
        sessionId: session,
        callbackUrl,
        store,
        config: config('youtube'),
        now,
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      completeSocialOAuthCallback({
        provider: 'youtube',
        userId: owner,
        sessionId: otherSession,
        callbackUrl,
        store,
        config: config('youtube'),
        now,
      }),
    ).rejects.toMatchObject({ status: 400 });

    const completed = await completeSocialOAuthCallback({
      provider: 'youtube',
      userId: owner,
      sessionId: session,
      callbackUrl,
      store,
      config: config('youtube'),
      now,
    });
    expect(completed.authorizationCode).toBe('simulated-code');
    expect(completed.codeVerifier).toBe(transaction.pkceVerifier);
    await expect(
      completeSocialOAuthCallback({
        provider: 'youtube',
        userId: owner,
        sessionId: session,
        callbackUrl,
        store,
        config: config('youtube'),
        now,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects expired state, malformed/ambiguous callbacks, and consumes provider denials safely', async () => {
    const url = await beginSocialOAuth({
      provider: 'instagram',
      userId: owner,
      sessionId: session,
      store,
      config: config('instagram'),
      now,
    });
    const state = url.searchParams.get('state')!;
    const expired = store.transactions[0]!;
    expired.expiresAt = new Date(now.getTime() - 1).toISOString();
    await expect(
      completeSocialOAuthCallback({
        provider: 'instagram',
        userId: owner,
        sessionId: session,
        callbackUrl: `${config('instagram').redirectUri}?code=x&state=${state}`,
        store,
        config: config('instagram'),
        now,
      }),
    ).rejects.toMatchObject({ status: 400 });

    const next = await beginSocialOAuth({
      provider: 'instagram',
      userId: owner,
      sessionId: session,
      store,
      config: config('instagram'),
      now,
    });
    const nextState = next.searchParams.get('state')!;
    for (const callbackUrl of [
      `${config('instagram').redirectUri}?code=x&state=${nextState}&state=${nextState}`,
      `${config('instagram').redirectUri}?code=x&state=${nextState}&other=x`,
      `https://evil.test/api/social-accounts/oauth/callback/instagram?code=x&state=${nextState}`,
      `${config('instagram').redirectUri}?code=x&error=access_denied&state=${nextState}`,
    ]) {
      await expect(
        completeSocialOAuthCallback({
          provider: 'instagram',
          userId: owner,
          sessionId: session,
          callbackUrl,
          store,
          config: config('instagram'),
          now,
        }),
      ).rejects.toMatchObject({ status: 400 });
    }

    const denial = await beginSocialOAuth({
      provider: 'instagram',
      userId: owner,
      sessionId: session,
      store,
      config: config('instagram'),
      now,
    });
    const denialState = denial.searchParams.get('state')!;
    const denialCallback = `${config('instagram').redirectUri}?error=access_denied&state=${denialState}`;
    await expect(
      completeSocialOAuthCallback({
        provider: 'instagram',
        userId: owner,
        sessionId: session,
        callbackUrl: denialCallback,
        store,
        config: config('instagram'),
        now,
      }),
    ).rejects.toMatchObject({ message: 'La connexion fournisseur a été annulée.' });
    await expect(
      completeSocialOAuthCallback({
        provider: 'instagram',
        userId: owner,
        sessionId: session,
        callbackUrl: denialCallback,
        store,
        config: config('instagram'),
        now,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('accepts TikTok’s documented granted-scopes callback parameter without trusting it', async () => {
    const authorizationUrl = await beginSocialOAuth({
      provider: 'tiktok',
      userId: owner,
      sessionId: session,
      store,
      config: config('tiktok'),
      now,
    });
    const state = authorizationUrl.searchParams.get('state')!;
    const result = await completeSocialOAuthCallback({
      provider: 'tiktok',
      userId: owner,
      sessionId: session,
      callbackUrl: `${config('tiktok').redirectUri}?code=simulated-code&state=${state}&scopes=user.info.basic`,
      store,
      config: config('tiktok'),
      now,
    });
    expect(result.authorizationCode).toBe('simulated-code');
    expect(result.codeVerifier).toBeNull();
  });
});
