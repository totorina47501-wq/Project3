import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  requireUser: vi.fn(),
  limit: vi.fn(),
  logger: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: vi.fn(async () => ({ auth: {
    resetPasswordForEmail: mocks.resetPasswordForEmail,
    exchangeCodeForSession: mocks.exchangeCodeForSession,
    verifyOtp: mocks.verifyOtp,
  } })),
}));
vi.mock('@/lib/security/auth-attempt-limit', () => ({ requireAuthAttemptLimit: mocks.limit }));
vi.mock('@/lib/security/logging', () => ({ logServerError: mocks.logger }));
vi.mock('@/lib/security/auth', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/security/auth')>(),
  requireUser: mocks.requireUser,
}));

import { HttpError } from '@/lib/security/auth';
import { POST as requestReset } from '@/app/api/auth/request-password-reset/route';
import { GET as recovery } from '@/app/api/auth/recovery/route';
import { POST as updatePassword } from '@/app/api/auth/update-password/route';

const email = 'fixture@example.test';
const strongPassword = 'Complex-Nouveau123!';
function post(route: string, body: unknown, origin = 'https://mentioncheck.test') {
  return new Request('https://mentioncheck.test/api/auth/' + route, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.limit.mockResolvedValue(undefined);
  mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
  mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
  mocks.verifyOtp.mockResolvedValue({ error: null });
  mocks.updateUser.mockResolvedValue({ error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.requireUser.mockResolvedValue({ client: { auth: {
    updateUser: mocks.updateUser, signOut: mocks.signOut,
  } }, user: { id: 'user-fixture' } });
});
afterEach(() => vi.unstubAllEnvs());

describe('Mot de passe oublié sécurisé', () => {
  it('envoie un lien uniquement vers le callback du domaine, avec réponse neutre', async () => {
    const response = await requestReset(post('request-password-reset', { email }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.message).not.toContain(email);
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith(email, {
      redirectTo: 'https://mentioncheck.test/api/auth/recovery',
    });
  });

  it('ne révèle pas les comptes inconnus ou inexistants', async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({ error: { status: 404, message: 'User not found' } });
    const response = await requestReset(post('request-password-reset', { email }));
    expect(response.status).toBe(200);
    expect(JSON.stringify(await response.json())).not.toContain('User not found');
  });

  it('refuse les origines tierces et données invalides avant le fournisseur', async () => {
    expect((await requestReset(post('request-password-reset', { email }, 'https://evil.test'))).status).toBe(403);
    expect((await requestReset(post('request-password-reset', { email: 'invalid' }))).status).toBe(400);
    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('applique les limites anti-abus du fournisseur', async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({ error: { status: 429, message: 'provider internal' } });
    const response = await requestReset(post('request-password-reset', { email }));
    expect(response.status).toBe(429);
    expect(JSON.stringify(await response.json())).not.toContain('provider internal');
  });

  it('échange le code de récupération sans redirection arbitraire', async () => {
    const response = await recovery(new NextRequest(
      'https://mentioncheck.test/api/auth/recovery?code=one-time-code&next=https://evil.test',
    ));
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://mentioncheck.test/reset-password');
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith('one-time-code');
  });

  it('accepte un token hash uniquement pour le type recovery', async () => {
    const response = await recovery(new NextRequest(
      'https://mentioncheck.test/api/auth/recovery?token_hash=valid-hash&type=recovery',
    ));
    expect(response.headers.get('location')).toBe('https://mentioncheck.test/reset-password');
    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      type: 'recovery', token_hash: 'valid-hash',
    });
    const wrongType = await recovery(new NextRequest(
      'https://mentioncheck.test/api/auth/recovery?token_hash=x&type=signup',
    ));
    expect(wrongType.headers.get('location')).toContain('/forgot-password?error=invalid_link');
    expect(mocks.verifyOtp).toHaveBeenCalledTimes(1);
  });

  it('renvoie vers un lien neuf quand le token est expiré', async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: { status: 400, message: 'expired' } });
    const response = await recovery(new NextRequest(
      'https://mentioncheck.test/api/auth/recovery?code=expired-code',
    ));
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://mentioncheck.test/forgot-password?error=invalid_link');
  });

  it('refuse la modification sans session validée', async () => {
    mocks.requireUser.mockRejectedValue(new HttpError(401, 'Connecte-toi pour continuer.'));
    const response = await updatePassword(post('update-password', { password: strongPassword }));
    expect(response.status).toBe(401);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it('valide le mot de passe et nettoie la session locale après modification', async () => {
    const response = await updatePassword(post('update-password', { password: strongPassword }));
    expect(response.status).toBe(200);
    expect((await response.json()).ok).toBe(true);
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: strongPassword });
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('refuse mot de passe faible et origine tierce sans mutation', async () => {
    expect((await updatePassword(post('update-password', { password: 'password' }))).status).toBe(400);
    expect((await updatePassword(post('update-password', { password: strongPassword }, 'https://evil.test'))).status).toBe(403);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
});
