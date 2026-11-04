// Frontière HTTP de test locale. Ce module n'est jamais importé par l'application.
import { createServer } from 'node:http';

export const FIXTURE_USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const FIXTURE_EMAIL = 'createur@example.test';
const CREATED_AT = '2026-11-01T12:00:00.000Z';
const user = {
  id: FIXTURE_USER_ID,
  aud: 'authenticated', role: 'authenticated', email: FIXTURE_EMAIL,
  email_confirmed_at: CREATED_AT, confirmed_at: CREATED_AT,
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {}, identities: [], created_at: CREATED_AT, updated_at: CREATED_AT,
  is_anonymous: false,
};

export function createFixtureSession() {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return {
    access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
      sub: FIXTURE_USER_ID, aud: 'authenticated', role: 'authenticated',
      exp: expiresAt, iat: expiresAt - 3600, email: FIXTURE_EMAIL,
    })}.offline-fixture`,
    token_type: 'bearer', expires_in: 3600, expires_at: expiresAt,
    refresh_token: 'offline-fixture-refresh-token', user,
  };
}

function localIdentity(request) {
  const token = request.headers.authorization?.replace(/^Bearer /, '');
  if (!token?.endsWith('.offline-fixture')) return false;
  try {
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    return claims.sub === FIXTURE_USER_ID && claims.exp > Date.now() / 1000;
  } catch { return false; }
}

function send(response, status, payload, headers = {}) {
  response.writeHead(status, {
    'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers,
  });
  response.end(JSON.stringify(payload));
}

export function createFixtureServer() {
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (url.pathname === '/health') return send(response, 200, { fixture: true });
    if (url.pathname === '/auth/v1/token' && request.method === 'POST') {
      let text = '';
      for await (const chunk of request) {
        text += chunk.toString();
        if (Buffer.byteLength(text) > 4096) return send(response, 413, { error: 'Corps trop volumineux.' });
      }
      let input;
      try { input = JSON.parse(text); }
      catch { return send(response, 400, { error: 'JSON invalide.' }); }
      if (input.refresh_token === 'offline-fixture-refresh-token' ||
          (input.email === FIXTURE_EMAIL && input.password === 'Fixture-local-2026!'))
        return send(response, 200, createFixtureSession());
      return send(response, 400, { code: 'invalid_credentials', msg: 'Identifiants de fixture invalides.' });
    }
    if (url.pathname === '/auth/v1/user')
      return localIdentity(request) ? send(response, 200, user)
        : send(response, 401, { code: 'bad_jwt', msg: 'Session locale requise.' });
    if (url.pathname === '/auth/v1/logout' && request.method === 'POST')
      return send(response, 200, {});

    if (url.pathname.startsWith('/rest/v1/')) {
      if (!localIdentity(request)) return send(response, 401, { message: 'Session locale requise.' });
      if (!['GET', 'HEAD'].includes(request.method ?? ''))
        return send(response, 405, { message: 'Les mutations sont simulées à leur frontière dans les tests.' });
      const table = url.pathname.slice('/rest/v1/'.length);
      const data = table === 'users' ? [{
        id: FIXTURE_USER_ID, email: FIXTURE_EMAIL, plan: 'studio',
        ai_training_opt_in: false, created_at: CREATED_AT, updated_at: CREATED_AT,
      }] : table === 'user_preferences' ? [{ user_id: FIXTURE_USER_ID, rewrite_tone: 'naturel' }] : [];
      const single = request.headers.accept?.includes('application/vnd.pgrst.object+json');
      const headers = { 'Content-Range': data.length ? `0-${data.length - 1}/${data.length}` : '*/0' };
      if (single && data.length !== 1) return send(response, 406, {
        code: 'PGRST116', message: 'Aucun objet unique dans la fixture.',
      }, headers);
      return send(response, 200, single ? data[0] : data, headers);
    }
    return send(response, 404, { message: 'Endpoint absent de la fixture locale.' });
  });
}
