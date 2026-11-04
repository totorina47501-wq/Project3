import { describe, it, expect } from 'vitest';
import { buildMediaReadyUpdate, readyMediaResponse } from '../../lib/media/integrity';

const digest = 'a'.repeat(64);
const now = new Date('2026-11-04T12:00:00.000Z');

describe('media persistence integrity (no network)', () => {
  it('persists digest atomically with ready transition when enabled', () => {
    expect(buildMediaReadyUpdate(123, digest, true, now)).toEqual({
      status: 'ready',
      actual_bytes: 123,
      completed_at: now.toISOString(),
      expires_at: '2026-12-04T12:00:00.000Z',
      media_sha256: digest,
    });
  });
  it('does not write a missing column before deployment/migration', () => {
    const patch = buildMediaReadyUpdate(123, digest, false, now);
    expect(patch).not.toHaveProperty('media_sha256');
    expect(patch.status).toBe('ready');
  });
  it('rejects oversized uploads and malformed hashes', () => {
    for (const bytes of [0, -1, 1.5, 50 * 1024 * 1024 + 1]) {
      expect(() => buildMediaReadyUpdate(bytes, digest, true)).toThrow();
    }
    for (const bad of ['a'.repeat(63), 'A'.repeat(64), '../media', 'z'.repeat(64)]) {
      expect(() => buildMediaReadyUpdate(1, bad, true)).toThrow();
    }
  });
  it('returns persisted digest only when known and valid', async () => {
    const existing = readyMediaResponse(digest);
    expect(await existing.json()).toEqual({ ready: true, mediaSha256: digest });
    expect(existing.headers.get('Cache-Control')).toBe('no-store');
    expect(await readyMediaResponse(null).json()).toEqual({ ready: true });
    expect(await readyMediaResponse('tampered').json()).toEqual({ ready: true });
  });
});
