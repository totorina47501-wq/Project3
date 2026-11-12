import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/admin';
import type {
  OAuthTransaction,
  OAuthTransactionStore,
} from './protocol';
import type { SocialOAuthProvider } from './providers';

type OAuthAdminClient = ReturnType<typeof createAdminSupabase>;

export function createSocialOAuthTransactionStore(
  admin: OAuthAdminClient = createAdminSupabase(),
): OAuthTransactionStore {
  return {
    async create(transaction: OAuthTransaction) {
      const { error } = await admin.from('social_oauth_transactions').insert({
        user_id: transaction.userId,
        session_id: transaction.sessionId,
        provider: transaction.provider,
        state_hash: transaction.stateHash,
        pkce_verifier: transaction.pkceVerifier,
        redirect_uri: transaction.redirectUri,
        expires_at: transaction.expiresAt,
      });
      if (error) throw new Error('OAuth transaction unavailable.');
    },
    async consume(input) {
      const { data, error } = await admin.rpc('consume_social_oauth_transaction', {
        p_user: input.userId,
        p_session: input.sessionId,
        p_provider: input.provider,
        p_state_hash: input.stateHash,
      });
      if (error) throw new Error('OAuth transaction unavailable.');
      const row = Array.isArray(data) ? data[0] : null;
      if (!row) return null;
      const provider = row.provider as SocialOAuthProvider;
      return {
        userId: row.user_id as string,
        sessionId: row.session_id as string,
        provider,
        stateHash: row.state_hash as string,
        pkceVerifier: row.pkce_verifier as string | null,
        redirectUri: row.redirect_uri as string,
        expiresAt: row.expires_at as string,
      };
    },
  };
}
