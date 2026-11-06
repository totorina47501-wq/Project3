import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getContext: vi.fn() }));
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: mocks.getContext }));

import { checkRateLimit } from '../../lib/security/rate-limit';

function limiter(limit: number) {
  const calls: string[] = [];
  const counts = new Map<string, number>();
  return {
    calls,
    binding: {
      limit: vi.fn(async ({ key }: { key: string }) => {
        calls.push(key);
        const count = (counts.get(key) ?? 0) + 1;
        counts.set(key, count);
        return { success: count <= limit };
      }),
    },
  };
}

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
  mocks.getContext.mockReset();
});

afterEach(() => vi.unstubAllEnvs());

it('borne une rafale simulée par compte et choisit le limiteur du plan', async () => {
  const solo = limiter(30);
  const paid = limiter(120);
  mocks.getContext.mockResolvedValue({ env: { API_SOLO_LIMITER: solo.binding, API_PAID_LIMITER: paid.binding } });

  const attempts = await Promise.allSettled(
    Array.from({ length: 36 }, () => checkRateLimit('solo-account', 'solo')),
  );

  expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(30);
  expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(6);
  expect(attempts.every((attempt) => attempt.status !== 'rejected' || attempt.reason.status === 429)).toBe(true);
  expect(solo.calls).toEqual(Array(36).fill('solo-account'));
  expect(paid.binding.limit).not.toHaveBeenCalled();

  await checkRateLimit('paid-account', 'pro');
  expect(paid.calls).toEqual(['paid-account']);
});

it('échoue fermé si le binding Cloudflare est absent', async () => {
  mocks.getContext.mockResolvedValue({ env: {} });

  await expect(checkRateLimit('account', 'solo')).rejects.toMatchObject({ status: 503 });
});

it('ne dépend pas du runtime Cloudflare hors production', async () => {
  vi.stubEnv('NODE_ENV', 'test');

  await expect(checkRateLimit('account', 'solo')).resolves.toBeUndefined();
  expect(mocks.getContext).not.toHaveBeenCalled();
});
