import { describe, expect, it, vi } from 'vitest';
import { hashPrivateMedia } from '../../lib/evidence/private-media';
import { sha256Blob } from '../../lib/evidence/sha256';

describe('private Storage evidence hashing', () => {
  const bytes = new Blob([new Uint8Array([1, 2, 3, 4])]);
  it('hashes only bytes downloaded by the trusted server', async () => {
    const download = vi.fn(async () => ({ data: bytes, error: null }));
    expect(await hashPrivateMedia({ download }, 'user/asset.png', 4))
      .toBe(await sha256Blob(bytes));
    expect(download).toHaveBeenCalledWith('user/asset.png');
  });
  it('refuses malformed paths before downloading', async () => {
    const download = vi.fn(async () => ({ data: bytes, error: null }));
    for (const path of ['', '../secret', '/absolute', 'https://example.test/a']) {
      await expect(hashPrivateMedia({ download }, path, 4)).rejects.toThrow();
    }
    expect(download).not.toHaveBeenCalled();
  });
  it('rejects mismatched size, over-limit input and download failures', async () => {
    const download = vi.fn(async () => ({ data: bytes, error: null }));
    await expect(hashPrivateMedia({ download }, 'user/asset.png', 3)).rejects.toThrow();
    await expect(hashPrivateMedia({ download }, 'user/asset.png', 4, 3)).rejects.toThrow();
    expect(download).toHaveBeenCalledTimes(1);
    await expect(hashPrivateMedia({ download: async () => ({ data: null, error: 'unavailable' }) },
      'user/asset.png', 4)).rejects.toThrow();
  });
});
