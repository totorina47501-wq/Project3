import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../../app/api/health/ai/route';

afterEach(() => vi.unstubAllEnvs());

describe('GET /api/health/ai — sans requête ni secret exposé', () => {
  it('signale un service configuré si les capacités et le secret sont présents', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-sensitive-never-returned');
    vi.stubEnv('OPENAI_PAUSED', 'false');
    vi.stubEnv('OPENAI_TEXT_ENABLED', 'true');
    vi.stubEnv('OPENAI_VISION_ENABLED', 'true');
    const response = GET();
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json).toEqual({
      service: 'mentioncheck-ai',
      probe: 'ai-prod-20261110',
      status: 'configured',
    });
    expect(JSON.stringify(json)).not.toContain('sk-sensitive-never-returned');
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(response.headers.get('X-Robots-Tag')).toContain('noindex');
  });
  it('signale indisponible si la pause est active', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-sensitive-never-returned');
    vi.stubEnv('OPENAI_PAUSED', 'true');
    vi.stubEnv('OPENAI_TEXT_ENABLED', 'true');
    vi.stubEnv('OPENAI_VISION_ENABLED', 'true');
    const response = GET();
    expect(response.status).toBe(503);
    expect((await response.json()).status).toBe('not_configured');
  });
  it('refuse de déclarer prêt sans clé ou sans vision', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('OPENAI_PAUSED', 'false');
    vi.stubEnv('OPENAI_TEXT_ENABLED', 'true');
    vi.stubEnv('OPENAI_VISION_ENABLED', 'true');
    expect(GET().status).toBe(503);
    vi.stubEnv('OPENAI_API_KEY','sk-private');
    vi.stubEnv('OPENAI_VISION_ENABLED','false');
    expect(GET().status).toBe(503);
  });
});
