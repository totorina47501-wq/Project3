// Technical integrity, not a signed legal certificate.
export const MEDIA_MAX_BYTES = 50 * 1024 * 1024;
const DIGEST = /^[a-f0-9]{64}$/;

export function buildMediaReadyUpdate(
  bytes: number,
  sha256: string,
  persistDigest: boolean,
  now = new Date(),
) {
  if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > MEDIA_MAX_BYTES ||
      !DIGEST.test(sha256)) {
    throw new Error('Invalid private media integrity metadata');
  }
  return {
    status: 'ready' as const,
    actual_bytes: bytes,
    completed_at: now.toISOString(),
    expires_at: new Date(now.getTime() + 30 * 86400_000).toISOString(),
    ...(persistDigest ? { media_sha256: sha256 } : {}),
  };
}

/** Never return a malformed or fabricated digest for legacy uploads. */
export function readyMediaResponse(sha256: string | null | undefined): Response {
  return Response.json({
    ready: true,
    ...(sha256 && DIGEST.test(sha256) ? { mediaSha256: sha256 } : {}),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
