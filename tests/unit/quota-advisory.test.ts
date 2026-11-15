import { describe, expect, it } from 'vitest';
import { isQuotaNearLimit } from '../../lib/billing/plans';

describe('orientation de quota', () => {
  it.each([
    [0, 3, false],
    [1, 3, false],
    [2, 3, false],
    [3, 3, true],
    [23, 30, false],
    [24, 30, true],
    [30, 30, true],
    [0, 0, false],
    [-1, 30, false],
  ] as const)('signale %i usages sur une limite de %i : %s', (used, limit, expected) => {
    expect(isQuotaNearLimit(used, limit)).toBe(expected);
  });
});
