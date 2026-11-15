import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  origin: vi.fn(),
  auth: vi.fn(),
  admin: vi.fn(),
  rate: vi.fn(),
  quota: vi.fn(),
  refund: vi.fn(),
  readiness: vi.fn(),
  generate: vi.fn(),
  omissions: vi.fn(),
  limits: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('../../lib/security/origin', () => ({ isSameOrigin: mocks.origin }));
vi.mock('../../lib/security/auth', async (original) => ({
  ...await original<typeof import('../../lib/security/auth')>(),
  requireUser: mocks.auth,
}));
vi.mock('../../lib/supabase/admin', () => ({ createAdminSupabase: mocks.admin }));
vi.mock('../../lib/security/rate-limit', () => ({ checkRateLimit: mocks.rate }));
vi.mock('../../lib/security/quota', () => ({
  consumeQuota: mocks.quota,
  refundQuota: mocks.refund,
}));
vi.mock('../../lib/openai/config', async (original) => ({
  ...await original<typeof import('../../lib/openai/config')>(),
  openaiReadiness: mocks.readiness,
}));
vi.mock('../../lib/mia/creator', async (original) => ({
  ...await original<typeof import('../../lib/mia/creator')>(),
  generateCreatorDraft: mocks.generate,
  extractOmissions: mocks.omissions,
  safePublishLimits: mocks.limits,
  supportedSafePublishRules: [{ code: 'R1', label: 'x', detail: 'y' }],
}));

import { POST } from '../../app/api/mia/creator/route';

const request = (body: Record<string, unknown>) => new Request('https://mentioncheck.test/api/mia/creator', {
  method: 'POST',
  headers: { origin: 'https://mentioncheck.test', 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.origin.mockReturnValue(true);
  mocks.auth.mockResolvedValue({ user: { id: '10000000-0000-4000-8000-000000000001' } });
  mocks.readiness.mockReturnValue({
    keyConfigured: true,
    paused: false,
    textEnabled: true,
    visionEnabled: true,
    audioEnabled: false,
    embeddingsEnabled: false,
  });
  mocks.admin.mockReturnValue({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: async () => table === 'users'
            ? { data: { plan: 'solo' }, error: null }
            : { data: null, error: null },
        }),
      }),
      insert: async () => ({ error: null }),
    }),
  });
  mocks.quota.mockResolvedValue('2026-11-01');
  mocks.generate.mockResolvedValue({
    hooks: ['A', 'B', 'C'],
    script: { durationSeconds: 45, lines: ['l1', 'l2', 'l3', 'l4'] },
    caption: 'Publicité — légende test.',
    cta: 'Dis-moi ton avis.',
    manualPlatformChecks: ['v1', 'v2', 'v3'],
    precheckViolations: [],
    usage: {
      model: 'gpt-4o',
      promptTokens: 12,
      completionTokens: 20,
      estimatedCostUsd: 0.00025,
      latencyMs: 3,
    },
  });
  mocks.omissions.mockReturnValue([]);
  mocks.limits.mockReturnValue(['limite']);
});

it('refuse si IA indisponible sans consommer quota ni appeler le générateur', async () => {
  mocks.readiness.mockReturnValue({
    keyConfigured: false,
    paused: true,
    textEnabled: false,
    visionEnabled: false,
    audioEnabled: false,
    embeddingsEnabled: false,
  });
  const response = await POST(request({
    niche: 'cuisine',
    platform: 'instagram',
    objective: 'engagement',
    topic: 'recette express',
    isPartnership: false,
  }));
  expect(response.status).toBe(503);
  expect((await response.json()).error).toContain('Generation IA indisponible');
  expect(mocks.quota).not.toHaveBeenCalled();
  expect(mocks.generate).not.toHaveBeenCalled();
});

it('retourne un brouillon structuré SafePublish quand les entrées sont valides', async () => {
  const response = await POST(request({
    niche: 'fitness',
    platform: 'tiktok',
    objective: 'conversion',
    topic: 'routine debutant',
    isPartnership: true,
  }));
  expect(response.status).toBe(200);
  const data = await response.json() as { hooks: string[]; safePublish: { limits: string[] } };
  expect(data.hooks).toEqual(['A', 'B', 'C']);
  expect(data.safePublish.limits).toEqual(['limite']);
  expect(mocks.quota).toHaveBeenCalledWith('10000000-0000-4000-8000-000000000001', 'mia');
  expect(mocks.generate).toHaveBeenCalledOnce();
  expect(mocks.refund).not.toHaveBeenCalled();
});

it('rejette les entrées invalides avant quota', async () => {
  const response = await POST(request({
    niche: 'x',
    platform: 'instagram',
    objective: 'engagement',
    topic: 'ok',
    isPartnership: false,
  }));
  expect(response.status).toBe(422);
  expect(mocks.quota).not.toHaveBeenCalled();
  expect(mocks.generate).not.toHaveBeenCalled();
});

it('refuse une origine tierce avant authentification', async () => {
  mocks.origin.mockReturnValue(false);
  const response = await POST(request({
    niche: 'fitness',
    platform: 'instagram',
    objective: 'engagement',
    topic: 'routine debutant',
    isPartnership: false,
  }));
  expect(response.status).toBe(403);
  expect(mocks.auth).not.toHaveBeenCalled();
  expect(mocks.quota).not.toHaveBeenCalled();
});
