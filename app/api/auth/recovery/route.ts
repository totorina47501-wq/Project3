import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { logServerError } from '@/lib/security/logging';

// Seuls les codes à usage unique émis par Supabase sont acceptés.
// Ne jamais conserver ces codes dans une URL après échange.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const tokenHash = request.nextUrl.searchParams.get('token_hash');
  const type = request.nextUrl.searchParams.get('type');
  const errorRedirect = new URL('/forgot-password?error=invalid_link', request.url);
  if (!code && !(tokenHash && type === 'recovery')) {
    return NextResponse.redirect(errorRedirect, 303);
  }
  try {
    const client = await createServerSupabase();
    const { error } = code
      ? await client.auth.exchangeCodeForSession(code)
      : await client.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash! });
    if (error) {
      logServerError('auth_password_recovery_failure', error, {
        category: 'invalid_or_expired_recovery_token',
      });
      return NextResponse.redirect(errorRedirect, 303);
    }
    return NextResponse.redirect(new URL('/reset-password', request.url), 303);
  } catch {
    return NextResponse.redirect(errorRedirect, 303);
  }
}
