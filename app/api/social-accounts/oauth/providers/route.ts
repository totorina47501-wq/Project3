import { requireUser } from '@/lib/security/auth';
import { settingsError, settingsHeaders } from '@/lib/social/server';
import {
  socialOAuthConfig,
  socialOAuthProviders,
} from '@/lib/social/oauth/providers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireUser();
    const available = Object.fromEntries(
      Object.keys(socialOAuthProviders).map((provider) => [
        provider,
        Boolean(socialOAuthConfig(provider as keyof typeof socialOAuthProviders)),
      ]),
    );
    return Response.json({ providers: available }, { headers: settingsHeaders });
  } catch (error) {
    return settingsError(error);
  }
}
