import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  from: vi.fn(),
  info: vi.fn(),
  hash: vi.fn(),
  select: vi.fn(),
  allowWrite: true,
  updateCount: 0,
  status: 'pending',
}));

vi.mock('server-only', () => ({}));
vi.mock('../../lib/security/auth', async original => ({
  ...await original<typeof import('../../lib/security/auth')>(),
  requireUser: mocks.requireUser,
}));
vi.mock('../../lib/supabase/admin', () => ({
  createAdminSupabase: () => ({
    from: mocks.from,
    storage: { from: () => ({ info: mocks.info }) },
  }),
}));
vi.mock('../../lib/evidence/private-media', () => ({ hashPrivateMedia: mocks.hash }));

import { POST } from '../../app/api/media/complete/route';

const owner = '95000000-0000-4000-8000-000000000001';
const asset = '95100000-0000-4000-8000-000000000001';
const digest = 'a'.repeat(64);
const request = () => new Request('https://mentioncheck.test/api/media/complete', {
  method: 'POST',
  headers: { origin: 'https://mentioncheck.test', 'content-type': 'application/json' },
  body: JSON.stringify({ assetId: asset }),
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  mocks.allowWrite = true;
  mocks.updateCount = 0;
  mocks.status = 'pending';
  mocks.requireUser.mockResolvedValue({ user: { id: owner } });
  mocks.info.mockResolvedValue({
    data: { size: 4, contentType: 'image/png' },
    error: null,
  });
  mocks.hash.mockResolvedValue(digest);
  mocks.from.mockImplementation(() => ({
    select: (columns: string) => {
      mocks.select(columns);
      const query = {
        eq: () => query,
        single: async () => ({
          data: {
            id: asset,
            storage_path: `${owner}/${asset}.png`,
            status: 'pending',
            mime_type: 'image/png',
            declared_bytes: 4,
            expires_at: '2099-01-01T00:00:00.000Z',
          },
          error: null,
        }),
        maybeSingle: async () => ({
          data: mocks.status === 'ready'
            ? { status: mocks.status, media_sha256: digest }
            : null,
          error: null,
        }),
      };
      return query;
    },
    update: () => {
      const wins = mocks.allowWrite && mocks.updateCount++ === 0;
      const query = {
        eq: () => query,
        gt: () => query,
        select: () => query,
        maybeSingle: async () => {
          if (wins) mocks.status = 'ready';
          return { data: wins ? { id: asset } : null, error: null };
        },
      };
      return query;
    },
  }));
});

afterEach(() => vi.unstubAllEnvs());

describe('media confirmation concurrency (offline)', () => {
  it('returns the winning confirmation when digest persistence is disabled', async () => {
    vi.stubEnv('MEDIA_SHA256_PERSISTENCE_ENABLED', 'false');

    const responses = await Promise.all([POST(request()), POST(request())]);

    expect(responses.map(response => response.status)).toEqual([200, 200]);
    expect(await Promise.all(responses.map(response => response.json())))
      .toEqual([{ ready: true, mediaSha256: digest }, { ready: true }]);
    expect(mocks.select.mock.calls.map(([columns]) => columns))
      .not.toContain('status,media_sha256');
  });

  it('returns the persisted digest to both confirmations when enabled', async () => {
    vi.stubEnv('MEDIA_SHA256_PERSISTENCE_ENABLED', 'true');

    const responses = await Promise.all([POST(request()), POST(request())]);

    expect(responses.map(response => response.status)).toEqual([200, 200]);
    expect(await Promise.all(responses.map(response => response.json())))
      .toEqual([{ ready: true, mediaSha256: digest }, { ready: true, mediaSha256: digest }]);
  });

  it('keeps a genuine pending-state conflict as 409', async () => {
    vi.stubEnv('MEDIA_SHA256_PERSISTENCE_ENABLED', 'false');
    mocks.allowWrite = false;

    const response = await POST(request());

    expect(response.status).toBe(409);
    expect(mocks.status).toBe('pending');
  });
});
