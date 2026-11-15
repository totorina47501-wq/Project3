import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  resend: vi.fn(),
  limit: vi.fn(),
  logger: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: vi.fn(async () => ({
    auth: { signInWithPassword: mocks.signInWithPassword, resend: mocks.resend },
  })),
}));
vi.mock('@/lib/security/auth-attempt-limit', () => ({
  requireAuthAttemptLimit: mocks.limit,
}));
vi.mock('@/lib/security/logging', () => ({ logServerError: mocks.logger }));

import { POST as login } from '@/app/api/auth/login/route';
import { POST as resendConfirmation } from '@/app/api/auth/resend-confirmation/route';

function request(path: string, body: unknown, origin = 'https://mentioncheck.test') {
  return new Request('https://mentioncheck.test/api/auth/' + path, {
    method: 'POST',
    headers: { origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.limit.mockResolvedValue(undefined);
  mocks.resend.mockResolvedValue({ error: null });
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-test-key');
});

describe('Confirmation email et connexion', () => {
  it('explique que la validation email est manquante seulement après vérification du mot de passe', async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: { code: 'email_not_confirmed', status: 400 } });
    const result = await login(request('login', { email: 'test@example.test', password: 'ValidPassword123!' }));
    expect(result.status).toBe(403);
    const body = await result.json();
    expect(body.code).toBe('email_not_confirmed');
    expect(body.error).toMatch(/non confirmée/i);
  });

  it('garde un message générique en cas de mauvais identifiants', async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: { code: 'invalid_credentials', status: 400 } });
    const result = await login(request('login', { email: 'test@example.test', password: 'wrong-password' }));
    expect(result.status).toBe(401);
    expect((await result.json()).code).toBeUndefined();
  });

  it('renvoie une confirmation sans exiger de mot de passe ni révéler si un compte existe', async () => {
    const result = await resendConfirmation(request('resend-confirmation', { email: 'test@example.test' }));
    expect(result.status).toBe(200);
    const body = await result.json();
    expect(body.ok).toBe(true);
    expect(body.message).not.toContain('test@example.test');
    expect(mocks.resend).toHaveBeenCalledWith({ type: 'signup', email: 'test@example.test' });
  });

  it('refuse une autre origine et une adresse malformée sans appel fournisseur', async () => {
    const wrongOrigin = await resendConfirmation(request('resend-confirmation', { email: 'test@example.test' }, 'https://evil.test'));
    expect(wrongOrigin.status).toBe(403);
    const invalidEmail = await resendConfirmation(request('resend-confirmation', { email: 'not-an-email' }));
    expect(invalidEmail.status).toBe(400);
    expect(mocks.resend).not.toHaveBeenCalled();
  });

  it('préserve la limite fournisseur sans renvoyer ses messages bruts', async () => {
    mocks.resend.mockResolvedValue({ error: { status: 429, message: 'internal-provider-detail' } });
    const result = await resendConfirmation(request('resend-confirmation', { email: 'test@example.test' }));
    expect(result.status).toBe(429);
    expect(JSON.stringify(await result.json())).not.toContain('internal-provider-detail');
  });
});
