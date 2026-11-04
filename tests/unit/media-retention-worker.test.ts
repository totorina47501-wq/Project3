import { describe, expect, it, vi, afterEach } from 'vitest';
import worker from '../../workers/media-retention/src/index';

const target = 'https://mentioncheck.toto-rina47501.workers.dev/api/internal/media-retention';
const secret = 'a'.repeat(48);
afterEach(() => vi.unstubAllGlobals());

describe('Cron rétention : sécurisé et sans IA', () => {
  it('ne contacte aucun service si la purge est désactivée', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await worker.scheduled({}, { MEDIA_RETENTION_ENABLED: 'false', MEDIA_RETENTION_URL: target, MEDIA_RETENTION_TOKEN: secret });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('refuse un hôte externe et ne divulgue pas le token', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(worker.scheduled({}, { MEDIA_RETENTION_ENABLED: 'true', MEDIA_RETENTION_URL: 'https://example.com/api/internal/media-retention', MEDIA_RETENTION_TOKEN: secret })).rejects.toThrow('Cible de rétention interdite.');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('appelle uniquement la purge authentifiée en cas d’activation explicite', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    await worker.scheduled({}, { MEDIA_RETENTION_ENABLED: 'true', MEDIA_RETENTION_URL: target, MEDIA_RETENTION_TOKEN: secret });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(target + '?execute=true');
    expect(init.method).toBe('POST');
    expect(init.headers.authorization).toBe('Bearer ' + secret);
  });
  it('remonte un échec sans déclarer une purge réussie', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    await expect(worker.scheduled({}, { MEDIA_RETENTION_ENABLED: 'true', MEDIA_RETENTION_URL: target, MEDIA_RETENTION_TOKEN: secret })).rejects.toThrow('Purge média incomplète');
  });
});
