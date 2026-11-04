import { sha256Blob } from './sha256';

export type PrivateMediaStorage = {
  download(path: string): Promise<{ data: Blob | null; error: unknown }>;
};

/**
 * Hashes private Storage bytes on the server. The caller must authorize the
 * owner and validate the exact path before invoking this helper.
 * This helper never accepts a public URL or a browser-supplied digest.
 */
export async function hashPrivateMedia(
  storage: PrivateMediaStorage,
  authorizedPath: string,
  expectedBytes: number,
  maxBytes = 50 * 1024 * 1024,
): Promise<string> {
  if (!authorizedPath || authorizedPath.startsWith('/') ||
      authorizedPath.includes('..') || authorizedPath.includes('://') ||
      !Number.isSafeInteger(expectedBytes) || expectedBytes < 1 ||
      expectedBytes > maxBytes) {
    throw new Error('Invalid authorized media input');
  }
  const { data, error } = await storage.download(authorizedPath);
  if (error || !data || data.size !== expectedBytes || data.size > maxBytes) {
    throw new Error('Private media bytes unavailable or mismatched');
  }
  return sha256Blob(data);
}
