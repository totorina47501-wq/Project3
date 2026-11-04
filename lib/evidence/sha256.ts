/** SHA-256 for evidence bytes. The digest must be computed on trusted, fetched bytes,
 * not on a hash supplied by the browser. This module does not persist evidence. */
export async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest('SHA-256', copy);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function sha256Blob(blob: Blob): Promise<string> {
  return sha256Bytes(new Uint8Array(await blob.arrayBuffer()));
}

/** Stable v1 manifest for future signed evidence. Do not silently alter its order. */
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
