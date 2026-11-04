import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), rpc: vi.fn(), limiter: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('../../lib/security/auth', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../lib/security/auth')>(), requireUser: mocks.requireUser,
}));
vi.mock('../../lib/supabase/admin', () => ({ createAdminSupabase: () => ({ rpc: mocks.rpc }) }));
vi.mock('../../lib/security/rate-limit', () => ({ checkRateLimit: mocks.limiter }));
import { GET, POST } from '../../app/api/studio/route';
import { GET as apiList } from '../../app/api/v1/verifications/route';
import { POST as apiCheck } from '../../app/api/v1/check/route';
import { HttpError } from '../../lib/security/auth';
import { hashSecret } from '../../lib/studio/secrets';
const actor = '10000000-0000-4000-8000-000000000001';
const workspaceId = '20000000-0000-4000-8000-000000000001';
const url = 'https://mentioncheck.test/api/studio';
const secret = 'mc_studio_' + 'a'.repeat(64);
function post(body: unknown, origin: string | null = 'https://mentioncheck.test') {
  return new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin ? { origin } : {}) }, body: JSON.stringify(body) });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUser.mockResolvedValue({ user: { id: actor, user_metadata: { plan: 'studio', role: 'owner' } } });
  mocks.rpc.mockResolvedValue({ data: { ok: true }, error: null });
});

describe('Studio sessions et stockage des secrets', () => {
  it('refuse une session absente et toute mutation sans origine identique', async () => {
    mocks.requireUser.mockRejectedValue(new HttpError(401, 'Connexion requise.'));
    expect((await GET(new Request(url))).status).toBe(401);
    expect((await POST(post({ action: 'create_workspace', name: 'A' }, null))).status).toBe(403);
    expect((await POST(post({ action: 'create_workspace', name: 'A' }, 'https://evil.test'))).status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('refuse plan, identité ou rôles usurpés dans le JSON', async () => {
    for (const payload of [
      { action: 'create_workspace', name: 'A', plan: 'studio' },
      { action: 'create_workspace', name: 'A', userId: actor },
      { action: 'invite', workspaceId, email: 'a@example.test', role: 'owner' },
    ]) expect((await POST(post(payload))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('passe l’identité de session à la transaction qui vérifie le plan réel', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'secret profile plan=solo' } });
    const response = await POST(post({ action: 'create_workspace', name: 'A' }));
    expect(response.status).toBe(403);
    expect(JSON.stringify(await response.json())).not.toContain('secret profile');
    expect(mocks.rpc).toHaveBeenCalledWith('studio_execute', { p_actor: actor, p_workspace: null, p_action: 'create_workspace', p_payload: { name: 'A' } });
  });
  it('ne transmet que l’empreinte invitation au stockage et renvoie le jeton une seule fois', async () => {
    mocks.rpc.mockResolvedValue({ data: { invitation: { id: 'invite-id' } }, error: null });
    const response = await POST(post({ action: 'invite', workspaceId, email: 'A@example.test', role: 'member' }));
    const body = await response.json();
    const stored = mocks.rpc.mock.calls[0]?.[1].p_payload;
    expect(body.token).toMatch(/^mc_invite_[0-9a-f]{64}$/);
    expect(stored).toEqual({ email: 'a@example.test', role: 'member', token_hash: await hashSecret(body.token) });
    expect(JSON.stringify(stored)).not.toContain(body.token);
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it('ne transmet que l’empreinte et le préfixe de la clé au stockage', async () => {
    const response = await POST(post({ action: 'create_key', workspaceId, name: 'integration', scopes: ['checks:read'] }));
    const body = await response.json();
    const stored = mocks.rpc.mock.calls[0]?.[1].p_payload;
    expect(stored.token_hash).toBe(await hashSecret(body.secret));
    expect(stored.prefix).toBe(body.secret.slice(0, 18));
    expect(JSON.stringify(stored)).not.toContain(body.secret);
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  });
  it('contrôle les textes avec les règles existantes et sans historique personnel', async () => {
    await POST(post({ action: 'check', workspaceId, caption: 'Publicité', platform: 'instagram' }));
    expect(mocks.rpc.mock.calls[0]?.[0]).toBe('studio_execute');
    expect(mocks.rpc.mock.calls[0]?.[1]).toMatchObject({ p_actor: actor, p_workspace: workspaceId, p_action: 'save_check', p_payload: { result: { analysisMode: 'rules_only', score: 100, violations: [] } } });
  });
  it('ne retourne pas les détails déjà lus si la seconde lecture perd l’autorisation', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { members: [{ email: 'private@example.test' }] }, error: null });
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '42501' } });
    const response = await GET(new Request(url + '?workspaceId=' + workspaceId));
    expect(response.status).toBe(403);
    expect(JSON.stringify(await response.json())).not.toContain('private@example.test');
  });
});

describe('API Studio avec clés limitées à leur équipe', () => {
  it('refuse les cookies seuls et toute clé mal formée', async () => {
    expect((await apiList(new Request(url, { headers: { cookie: 'session=yes' } }))).status).toBe(401);
    expect((await apiList(new Request(url, { headers: { authorization: 'Bearer mc_invite_' + 'b'.repeat(64) } }))).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('l’équipe provient exclusivement de la clé et le secret ne quitte pas le serveur en clair', async () => {
    const response = await apiList(new Request(url, { headers: { authorization: 'Bearer ' + secret } }));
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('studio_execute_api', { p_hash: await hashSecret(secret), p_action: 'checks', p_payload: {} });
    expect(mocks.requireUser).not.toHaveBeenCalled();
  });
  it('refuse les champs IA/équipe et ne contourne pas les scopes SQL', async () => {
    const request = (body: unknown) => new Request(url, { method: 'POST', headers: { authorization: 'Bearer ' + secret }, body: JSON.stringify(body) });
    expect((await apiCheck(request({ caption: 'Publicité', platform: 'instagram', workspaceId }))).status).toBe(400);
    expect((await apiCheck(request({ caption: 'Publicité', platform: 'instagram', execution: 'ai' }))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'scope missing secret table' } });
    const response = await apiCheck(request({ caption: 'Publicité', platform: 'instagram' }));
    expect(response.status).toBe(403);
    expect(JSON.stringify(await response.json())).not.toContain('secret table');
  });
});

describe('Studio lecture HTTP réellement bornée', () => {
  function apiRequest(body: BodyInit, headers: Record<string, string> = {}) {
    return new Request(url, { method: 'POST', body, headers: { authorization: 'Bearer ' + secret, ...headers }, duplex: 'half' } as RequestInit & { duplex: string });
  }
  it('rejette un Bearer absent ou mal formé avant de lire le corps', async () => {
    for (const authorization of ['', 'Bearer invalid']) {
      const request = new Request(url, { method: 'POST', headers: { authorization }, body: '{' });
      const read = vi.spyOn(request, 'json');
      const reader = vi.spyOn(request.body!, 'getReader');
      expect((await apiCheck(request)).status).toBe(401);
      expect(read).not.toHaveBeenCalled();
      expect(reader).not.toHaveBeenCalled();
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('refuse Content-Length supérieur à 64 Kio avant tout accès RPC', async () => {
    const response = await apiCheck(apiRequest('{"caption":"Publicité","platform":"instagram"}', { 'content-length': '65537' }));
    expect(response.status).toBe(413);
    expect(mocks.rpc).not.toHaveBeenCalled();
    const studio = post({ action: 'create_workspace', name: 'Équipe' });
    studio.headers.set('content-length', '65537');
    expect((await POST(studio)).status).toBe(413);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('compte les octets UTF8 chunked et annule la lecture à la limite', async () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ caption: 'é'.repeat(50000), platform: 'instagram' }));
    for (const endpoint of ['api', 'studio']) {
      let offset = 0;
      let cancelled = false;
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (offset >= bytes.length) { controller.close(); return; }
          controller.enqueue(bytes.slice(offset, offset + 16384)); offset += 16384;
        },
        cancel() { cancelled = true; },
      });
      const request = apiRequest(stream, endpoint === 'studio' ? { origin: 'https://mentioncheck.test' } : {});
      expect(request.headers.has('content-length')).toBe(false);
      const response = endpoint === 'studio' ? await POST(request) : await apiCheck(request);
      expect(response.status).toBe(413);
      expect(cancelled).toBe(true);
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('accepte les 10 000 caractères multioctets autorisés sous la borne UTF8', async () => {
    expect((await apiCheck(apiRequest(JSON.stringify({ caption: 'é'.repeat(10000), platform: 'instagram' })))).status).toBe(201);
  });
});
