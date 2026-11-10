import { z } from 'zod';
import { createSocialOAuthAccountStore } from '@/lib/social/oauth/accounts';
import { exchangeSocialOAuthCode } from '@/lib/social/oauth/exchange';
import { completeSocialOAuthCallback } from '@/lib/social/oauth/protocol';
import { socialOAuthConfig } from '@/lib/social/oauth/providers';
import { createSocialOAuthTransactionStore } from '@/lib/social/oauth/store';
import { requireSocialOAuthSession } from '@/lib/social/oauth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ provider: string }> };
const providerSchema = z.enum(['instagram', 'tiktok', 'youtube', 'linkedin']);

function returnToSettings(request: Request, result: 'connected' | 'unavailable', provider?: string) {
  const destination = new URL('/dashboard/settings', request.url);
  destination.searchParams.set('social_oauth', result);
  if (provider) destination.searchParams.set('provider', provider);
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
  if (!parsedProvider.success) return returnToSettings(request, 'unavailable');
  const provider = parsedProvider.data;

  try {
    const config = socialOAuthConfig(provider);
    if (!config) return returnToSettings(request, 'unavailable', provider);
    const { user, sessionId } = await requireSocialOAuthSession();
    const callback = await completeSocialOAuthCallback({
      provider,
      userId: user.id,
      sessionId,
      callbackUrl: request.url,
      store: createSocialOAuthTransactionStore(),
      config,
    });
    const exchanged = await exchangeSocialOAuthCode({
      provider,
      config,
      redirectUri: config.redirectUri,
      authorizationCode: callback.authorizationCode,
      codeVerifier: callback.codeVerifier,
    });
    await createSocialOAuthAccountStore().save({
      userId: user.id,
      provider,
      handle: exchanged.handle,
      tokenSecret: exchanged.tokenSecret,
      expiresAt: exchanged.expiresAt,
    });
    return returnToSettings(request, 'connected', provider);
  } catch {
    return returnToSettings(request, 'unavailable', provider);
  }
}
