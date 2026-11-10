import { HttpError, requireUser } from '@/lib/security/auth';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sessionIdFromJwt(token: string, userId: string): string | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const base64 = payload.replaceAll('-', '+').replaceAll('_', '/');
    const claims = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))) as {
      sub?: unknown;
      session_id?: unknown;
    };
    if (
      claims.sub !== userId ||
      typeof claims.session_id !== 'string' ||
      !UUID.test(claims.session_id)
    ) {
      return null;
    }
    return claims.session_id;
  } catch {
    return null;
  }
}

export async function requireSocialOAuthSession() {
  const { user, client } = await requireUser();
  const { data, error } = await client.auth.getSession();
  const session =
    !error && data.session?.user.id === user.id
      ? sessionIdFromJwt(data.session.access_token, user.id)
      : null;
  if (!session) throw new HttpError(401, 'Connecte-toi pour continuer.');
  return { user, sessionId: session, client };
}
