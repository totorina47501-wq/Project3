import { z } from 'zod';
import { HttpError } from '@/lib/security/auth';
import { beginSocialOAuth } from '@/lib/social/oauth/protocol';
import { createSocialOAuthTransactionStore } from '@/lib/social/oauth/store';
import { socialOAuthConfig } from '@/lib/social/oauth/providers';
import { requireSocialOAuthSession } from '@/lib/social/oauth/session';
import {
  settingsError,
  settingsHeaders,
  readBoundedJson,
} from '@/lib/social/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const providerSchema = z.object({
  provider: z.enum(['instagram', 'tiktok', 'youtube', 'linkedin']),
}).strict();

export async function POST(request: Request) {
  try {
    const parsed = providerSchema.safeParse(await readBoundedJson(request));
    if (!parsed.success) throw new HttpError(400, 'Réseau social invalide.');
    const { user, sessionId } = await requireSocialOAuthSession();
    const config = socialOAuthConfig(parsed.data.provider);
    if (!config) {
      throw new HttpError(503, 'Connexion indisponible pour ce réseau.');
    }
    const authorizationUrl = await beginSocialOAuth({
      provider: parsed.data.provider,
      userId: user.id,
      sessionId,
      store: createSocialOAuthTransactionStore(),
      config,
    });
    return Response.json(
      { authorizationUrl: authorizationUrl.toString() },
      { headers: settingsHeaders },
    );
  } catch (error) {
    return settingsError(error);
  }
}
