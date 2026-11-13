import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/admin';
import type { FacebookPageCandidate } from './exchange';
import type { SocialOAuthProvider } from './providers';

type OAuthAdminClient = ReturnType<typeof createAdminSupabase>;

const providers = new Set<SocialOAuthProvider>([
  'instagram',
  'tiktok',
  'youtube',
  'linkedin',
  'facebook',
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
    async stageFacebookPageSelection(input: {
      userId: string;
      sessionId: string;
      tokenSecret: string;
      pages: FacebookPageCandidate[];
    }): Promise<void> {
      const { error } = await admin.rpc('stage_facebook_page_selection', {
        p_user: input.userId,
        p_session: input.sessionId,
        p_token_secret: input.tokenSecret,
        p_pages: input.pages,
      });
      if (error) throw new Error('Facebook Page selection unavailable.');
    },
    async readFacebookPageSelection(input: {
      userId: string;
      sessionId: string;
    }): Promise<{ tokenSecret: string; pages: FacebookPageCandidate[] } | null> {
      const { data, error } = await admin.rpc('read_facebook_page_selection', {
        p_user: input.userId,
        p_session: input.sessionId,
      });
      if (error) throw new Error('Facebook Page selection unavailable.');
      if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
      const selection = data as { token_secret?: unknown; pages?: unknown };
      if (
        typeof selection.token_secret !== 'string' ||
        !Array.isArray(selection.pages) ||
        selection.pages.some((page) =>
          !page || typeof page !== 'object' ||
          typeof page.id !== 'string' || typeof page.name !== 'string'
        )
      ) {
        return null;
      }
      return {
        tokenSecret: selection.token_secret,
        pages: selection.pages as FacebookPageCandidate[],
      };
    },
    async saveFacebookPageSelection(input: {
      userId: string;
      sessionId: string;
      pageIds: string[];
    }): Promise<number> {
      const { data, error } = await admin.rpc('save_facebook_page_selection', {
        p_user: input.userId,
        p_session: input.sessionId,
        p_page_ids: input.pageIds,
      });
      if (error || !Number.isInteger(data)) {
        throw new Error('Facebook Page selection unavailable.');
      }
      return data as number;
    },
    async disconnectFacebookPages(input: { userId: string }): Promise<number> {
      const { data, error } = await admin.rpc('disconnect_facebook_oauth_accounts', {
        p_user: input.userId,
      });
      if (error || !Number.isInteger(data)) {
        throw new Error('Social OAuth account unavailable.');
      }
      return data as number;
    },
  };
}
