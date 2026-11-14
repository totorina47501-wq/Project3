import { z } from 'zod';
import { createSocialOAuthAccountStore } from '@/lib/social/oauth/accounts';
import {
  exchangeFacebookOAuthCode,
  exchangeSocialOAuthCode,
  revokeSocialOAuthToken,
  OAuthProviderStageError,
  type OAuthProviderErrorReason,
} from '@/lib/social/oauth/exchange';
import { completeSocialOAuthCallback } from '@/lib/social/oauth/protocol';
import { socialOAuthConfig } from '@/lib/social/oauth/providers';
import { createSocialOAuthTransactionStore } from '@/lib/social/oauth/store';
import { requireSocialOAuthSession } from '@/lib/social/oauth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ provider: string }> };
const providerSchema = z.enum(['instagram', 'tiktok', 'youtube', 'linkedin', 'facebook']);

function returnToSettings(
  result: 'connected' | 'pages' | 'unavailable',
  provider?: string,
  stage?: 'token' | 'channel' | 'storage',
  reason?: OAuthProviderErrorReason,
) {
  const publicOrigin = process.env.SOCIAL_OAUTH_PUBLIC_ORIGIN;
  const allowedOrigins = (process.env.SOCIAL_OAUTH_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim());
  let origin: URL;
  try {
    origin = new URL(publicOrigin ?? '');
  } catch {
    return Response.json(
      { error: 'Connexion indisponible.' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
  if (
    origin.protocol !== 'https:' ||
    origin.origin !== publicOrigin ||
    !allowedOrigins.includes(origin.origin)
  ) {
    return Response.json(
      { error: 'Connexion indisponible.' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
  const destination = new URL('/dashboard/settings', origin);
  destination.searchParams.set('social_oauth', result);
  if (provider) destination.searchParams.set('provider', provider);
  if (result === 'unavailable' && stage) destination.searchParams.set('social_oauth_error', stage);
  if (result === 'unavailable' && (stage === 'token' || stage === 'channel') && reason) {
    destination.searchParams.set('social_oauth_reason', reason);
  }
  return new Response(null, {
    status: 303,
    headers: {
      Location: destination.toString(),
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

export async function GET(request: Request, context: Context) {
  const { provider: rawProvider } = await context.params;
  const parsedProvider = providerSchema.safeParse(rawProvider);
  if (!parsedProvider.success) return returnToSettings('unavailable');
  const provider = parsedProvider.data;

  try {
    const config = socialOAuthConfig(provider);
    if (!config) return returnToSettings('unavailable', provider);
    const { user, sessionId } = await requireSocialOAuthSession();
    const callback = await completeSocialOAuthCallback({
      provider,
      userId: user.id,
      sessionId,
      callbackUrl: request.url,
      store: createSocialOAuthTransactionStore(),
      config,
    });
    if (provider === 'facebook') {
      const exchanged = await exchangeFacebookOAuthCode({
        config,
        redirectUri: config.redirectUri,
        authorizationCode: callback.authorizationCode,
      });
      try {
        await createSocialOAuthAccountStore().stageFacebookPageSelection({
          userId: user.id,
          sessionId,
          tokenSecret: exchanged.tokenSecret,
          pages: exchanged.pages,
        });
      } catch {
        try {
          await revokeSocialOAuthToken({
            provider,
            config,
            tokenSecret: exchanged.tokenSecret,
          });
        } catch {}
        return returnToSettings('unavailable', provider, 'storage');
      }
      return returnToSettings('pages', provider);
    }

    const exchanged = await exchangeSocialOAuthCode({
      provider,
      config,
      redirectUri: config.redirectUri,
      authorizationCode: callback.authorizationCode,
      codeVerifier: callback.codeVerifier,
    });
    try {
      await createSocialOAuthAccountStore().save({
        userId: user.id,
        provider,
        handle: exchanged.handle,
        tokenSecret: exchanged.tokenSecret,
        expiresAt: exchanged.expiresAt,
      });
    } catch {
      try {
        await revokeSocialOAuthToken({
          provider,
          config,
          tokenSecret: exchanged.tokenSecret,
        });
      } catch {}
      return returnToSettings('unavailable', provider, 'storage');
    }
    return returnToSettings('connected', provider);
  } catch (error) {
    return returnToSettings(
      'unavailable',
      provider,
      error instanceof OAuthProviderStageError ? error.stage : undefined,
      error instanceof OAuthProviderStageError ? error.reason : undefined,
    );
  }
}
