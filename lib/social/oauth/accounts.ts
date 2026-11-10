import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/admin';
import type { SocialOAuthProvider } from './providers';

type OAuthAdminClient = ReturnType<typeof createAdminSupabase>;

const providers = new Set<SocialOAuthProvider>([
  'instagram',
  'tiktok',
  'youtube',
  'linkedin',
]);

export function createSocialOAuthAccountStore(
  admin: OAuthAdminClient = createAdminSupabase(),
) {
  return {
    async save(input: {
      userId: string;
      provider: SocialOAuthProvider;
      handle: string;
      tokenSecret: string;
      expiresAt: string;
    }): Promise<string> {
      const { data, error } = await admin.rpc('save_social_oauth_account', {
        p_user: input.userId,
        p_platform: input.provider,
        p_handle: input.handle,
        p_token_secret: input.tokenSecret,
        p_expires_at: input.expiresAt,
      });
      if (error || typeof data !== 'string') {
        throw new Error('Social OAuth account unavailable.');
      }
      return data;
    },
    async readCredential(input: {
      userId: string;
      accountId: string;
    }): Promise<{ provider: SocialOAuthProvider; tokenSecret: string } | null> {
      const { data, error } = await admin.rpc('read_social_oauth_token', {
        p_user: input.userId,
        p_account: input.accountId,
      });
      if (error) throw new Error('Social OAuth account unavailable.');
      if (!data || typeof data !== 'object') return null;
      const credential = data as { provider?: unknown; token_secret?: unknown };
      if (
        typeof credential.provider !== 'string' ||
        !providers.has(credential.provider as SocialOAuthProvider) ||
        typeof credential.token_secret !== 'string'
      ) {
        return null;
      }
      return {
        provider: credential.provider as SocialOAuthProvider,
        tokenSecret: credential.token_secret,
      };
    },
    async disconnect(input: { userId: string; accountId: string }): Promise<void> {
      const { error } = await admin.rpc('disconnect_social_oauth_account', {
        p_user: input.userId,
        p_account: input.accountId,
      });
      if (error) throw new Error('Social OAuth account unavailable.');
    },
    async expireDue(userId: string): Promise<void> {
      const { error } = await admin.rpc('expire_social_oauth_accounts', {
        p_user: userId,
      });
      if (error) throw new Error('Social OAuth account unavailable.');
    },
  };
}
