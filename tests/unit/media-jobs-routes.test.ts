import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), rpc: vi.fn(), rate: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('../../lib/security/auth', async original => ({ ...await original<typeof import('../../lib/security/auth')>(), requireUser: mocks.requireUser }));
vi.mock('../../lib/supabase/admin', () => ({ createAdminSupabase: () => ({ rpc: mocks.rpc }) }));
vi.mock('../../lib/security/rate-limit', () => ({ checkRateLimit: mocks.rate }));
import { POST } from '../../app/api/media/jobs/route';
import { HttpError } from '../../lib/security/auth';
const user = '80000000-0000-4000-8000-000000000001';
const asset = '81000000-0000-4000-8000-000000000001';
const url = 'https://mentioncheck.test/api/media/jobs';
const request = (body: unknown, origin = 'https://mentioncheck.test') => new Request(url, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
afterEach(() => vi.unstubAllEnvs());
beforeEach(() => {
  vi.unstubAllEnvs(); vi.clearAllMocks();
  vi.stubEnv('MEDIA_PROCESSING_ENABLED', 'true'); vi.stubEnv('MEDIA_JOBS_SCHEMA_READY', 'true');
  mocks.requireUser.mockResolvedValue({ user: { id: user } });
  mocks.rpc.mockResolvedValue({ data: '83000000-0000-4000-8000-000000000001', error: null });
});
it('reste désactivé et ne contacte pas la base sans activation explicite', async () => {
  vi.stubEnv('MEDIA_PROCESSING_ENABLED', 'false');
  expect((await POST(request({}))).status).toBe(503); expect(mocks.rpc).not.toHaveBeenCalled();
});
it('exige une session et une origine correcte', async () => {
  expect((await POST(request({}, 'https://tiers.test'))).status).toBe(403);
  mocks.requireUser.mockRejectedValue(new HttpError(401, 'Connexion requise.'));
  expect((await POST(request({}))).status).toBe(401); expect(mocks.rpc).not.toHaveBeenCalled();
});
it('refuse corps volumineux, score ou identité injectés', async () => {
  expect((await POST(request({ action: 'enqueue', assetIds: [asset], caption: 'x'.repeat(70000), platform: 'instagram' }))).status).toBe(413);
  expect((await POST(request({ action: 'enqueue', assetIds: [asset], caption: 'Test', platform: 'instagram', userId: user, score: 100 }))).status).toBe(400);
});
it('calcule le score côté serveur et transmet uniquement l’identité authentifiée', async () => {
  const response = await POST(request({ action: 'enqueue', assetIds: [asset], caption: 'Merci @marque #collab', platform: 'instagram' }));
  expect(response.status).toBe(202);
  expect(mocks.rpc).toHaveBeenCalledWith('media_job_enqueue', expect.objectContaining({ p_user: user, p_analysis: expect.objectContaining({ score: expect.any(Number), violations: expect.any(Array) }) }));
  expect(response.headers.get('cache-control')).toContain('no-store');
});
it('traduit un refus de propriété sans exposer le message SQL', async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'secret' } });
  const response = await POST(request({ action: 'enqueue', assetIds: [asset], caption: 'Test', platform: 'instagram' }));
  expect(response.status).toBe(403); expect(await response.text()).not.toContain('secret');
});
it('annulation périmée répond 409', async () => {
  mocks.rpc.mockResolvedValue({ data: false, error: null });
  expect((await POST(request({ action: 'cancel', jobId: asset }))).status).toBe(409);
});
