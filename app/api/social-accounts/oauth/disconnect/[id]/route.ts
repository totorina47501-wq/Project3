import { requireUser } from '@/lib/security/auth';
import { createSocialOAuthAccountStore } from '@/lib/social/oauth/accounts';
import { revokeSocialOAuthToken } from '@/lib/social/oauth/exchange';
import { socialOAuthConfig, socialOAuthProviders } from '@/lib/social/oauth/providers';
import {
  accountId,
  assertSettingsOrigin,
  settingsError,
  settingsHeaders,
} from '@/lib/social/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

function facebookGrantKey(tokenSecret: string): string | null {
  try {
    const parsed: unknown = JSON.parse(tokenSecret);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const userAccessToken = (parsed as { userAccessToken?: unknown }).userAccessToken;
    return typeof userAccessToken === 'string' && userAccessToken.length > 0
      ? userAccessToken
      : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request, context: Context) {
  try {
    assertSettingsOrigin(request);
    const { user } = await requireUser();
    const id = accountId((await context.params).id);
    const store = createSocialOAuthAccountStore();
    const credential = await store.readCredential({ userId: user.id, accountId: id });
    if (!credential) {
      return Response.json(
        { error: 'Connexion sociale introuvable.' },
        { status: 404, headers: settingsHeaders },
      );
    }

    let revocation: 'confirmed' | 'unavailable' | 'unconfirmed' = 'unavailable';
    const config = socialOAuthConfig(credential.provider);
    if (credential.provider === 'facebook') {
      if (config) {
        revocation = 'unconfirmed';
        let allCredentialsRead = true;
        let credentials: string[] = [];
        try {
          credentials = await store.readFacebookCredentials({ userId: user.id });
        } catch {
          allCredentialsRead = false;
        }
        const targetGrant = facebookGrantKey(credential.tokenSecret);
        const grants = new Map<string, string>();
        let allRevocationsConfirmed =
          allCredentialsRead &&
          targetGrant !== null &&
          credentials.some((tokenSecret) => facebookGrantKey(tokenSecret) === targetGrant);
        for (const tokenSecret of [credential.tokenSecret, ...credentials]) {
          const grant = facebookGrantKey(tokenSecret);
          if (!grant) {
            allRevocationsConfirmed = false;
            continue;
          }
          grants.set(grant, tokenSecret);
        }
        for (const tokenSecret of grants.values()) {
          try {
            await revokeSocialOAuthToken({
              provider: credential.provider,
              config,
              tokenSecret,
            });
          } catch {
            allRevocationsConfirmed = false;
          }
        }
        if (allRevocationsConfirmed) revocation = 'confirmed';
      }
      const disconnectedPages = await store.disconnectFacebookPages({ userId: user.id });
      return Response.json(
        { disconnected: true, revocation, disconnectedPages },
        { headers: settingsHeaders },
      );
    }
    if (config) {
      try {
        await revokeSocialOAuthToken({
          provider: credential.provider,
          config,
          tokenSecret: credential.tokenSecret,
        });
        revocation = socialOAuthProviders[credential.provider].revocationEndpoint
          ? 'confirmed'
          : 'unavailable';
      } catch {
        revocation = 'unconfirmed';
      }
    }

    await store.disconnect({ userId: user.id, accountId: id });
    return Response.json(
      { disconnected: true, revocation },
      { headers: settingsHeaders },
    );
  } catch (error) {
    return settingsError(error);
  }
}
