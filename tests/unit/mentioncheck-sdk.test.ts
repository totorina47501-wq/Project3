import { describe, expect, it, vi } from 'vitest';
import { MentionCheckApiError, MentionCheckClient } from '../../sdk/mentioncheck';

const key = 'mc_studio_' + 'a'.repeat(64);
describe('MentionCheck SDK', () => {
  it('rejects invalid API keys and insecure origins', () => {
    expect(() => new MentionCheckClient({ apiKey: 'bad' })).toThrow();
    expect(() => new MentionCheckClient({ apiKey: key, baseUrl: 'http://example.com' })).toThrow();
  });

  it('sends a server-side authenticated check with expected body', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(JSON.stringify({ verification: { id: 'ok' } }), { status: 201 }));
    const client = new MentionCheckClient({ apiKey: key, fetchImpl: fetchImpl as typeof fetch });
    expect(await client.check({ caption: 'Publicité', platform: 'instagram' })).toEqual({ verification: { id: 'ok' } });
    const call = fetchImpl.mock.calls[0];
    expect(call).toBeDefined();
    const [url, init] = call!;
    expect(url).toContain('/api/v1/check');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer ' + key });
    expect(JSON.parse(init?.body as string)).toEqual({ caption: 'Publicité', platform: 'instagram' });
  });

  it('lists checks without a request body', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ items: [], limit: 100 })));
    const client = new MentionCheckClient({ apiKey: key, fetchImpl: fetchImpl as typeof fetch });
    expect(await client.verifications()).toEqual({ items: [], limit: 100 });
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining('/api/v1/verifications'),
      expect.objectContaining({ method: 'GET', body: undefined }));
  });

  it('exposes HTTP status without leaking secrets', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: 'Scope refusé' }), { status: 403 }));
    const client = new MentionCheckClient({ apiKey: key, fetchImpl: fetchImpl as typeof fetch });
    await expect(client.verifications()).rejects.toMatchObject({
      name: 'MentionCheckApiError', status: 403, message: 'Scope refusé',
    } satisfies Partial<MentionCheckApiError>);
  });

  it('honors an already aborted request', async () => {
    const abort = new AbortController();
    abort.abort();
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.signal?.aborted).toBe(true);
      throw new DOMException('Aborted', 'AbortError');
    });
    const client = new MentionCheckClient({ apiKey: key, fetchImpl: fetchImpl as typeof fetch });
    await expect(client.verifications(abort.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
});
