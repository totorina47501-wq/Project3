/** Technical integrity helpers. Hashes media bytes, never a filename or signed URL. */
export async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest('SHA-256', copy);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function sha256Blob(blob: Blob): Promise<string> {
  return sha256Bytes(new Uint8Array(await blob.arrayBuffer()));
}

export function evidenceManifestV1(input: {
  caption: string;
  platform: string;
  mediaType: string;
  mediaSha256: string | null;
}): string {
  return JSON.stringify({
    version: 1,
    caption: input.caption,
    platform: input.platform,
    mediaType: input.mediaType,
    mediaSha256: input.mediaSha256,
  });
}

/** Validate a downloaded blob against a trusted digest stored by the server. */
export async function verifyBlobSha256(blob: Blob, expectedSha256: string): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/.test(expectedSha256)) return false;
  const actual = await sha256Blob(blob);
  // Compare every byte of the two fixed-size hexadecimal digests.
  let difference = 0;
  for (let i = 0; i < 64; i++) {
    difference |= actual.charCodeAt(i) ^ expectedSha256.charCodeAt(i);
  }
  return difference === 0;
}
