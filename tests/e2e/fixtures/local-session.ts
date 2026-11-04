import type { BrowserContext } from '@playwright/test';

// Session factice vérifiée uniquement par scripts/e2e-fixture.mjs.
export async function useLocalSession(context: BrowserContext, baseURL: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  if (!['127.0.0.1', 'localhost'].includes(new URL(supabaseUrl).hostname)) {
    throw new Error('La fixture E2E doit être un serveur Supabase local.');
  }
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const user = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'createur@example.test',
    aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {},
    created_at: '2026-01-01T00:00:00Z' };
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const session = { access_token: `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ sub: user.id, exp: expiresAt, aud: 'authenticated' })}.offline-fixture`,
    refresh_token: 'offline-refresh-token', expires_at: expiresAt, expires_in: 3600,
    token_type: 'bearer', user };
  await context.addCookies([{ name: `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`,
    value: `base64-${part(session)}`, url: baseURL, sameSite: 'Lax' }]);
}
