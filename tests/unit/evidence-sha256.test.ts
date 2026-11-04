import { describe, expect, it } from 'vitest';
import { evidenceManifestV1, sha256Blob, sha256Bytes, verifyBlobSha256 } from '../../lib/evidence/sha256';

describe('integrite des preuves binaires', () => {
  it('produit le SHA-256 canonique pour un fichier vide', async () => {
    expect(await sha256Bytes(new Uint8Array())).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
  it('produit le SHA-256 canonique de abc', async () => {
    expect(await sha256Bytes(new TextEncoder().encode('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('un octet modifie change le digest et Blob egale bytes', async () => {
    const first = new Uint8Array([1, 2, 3]);
    const changed = new Uint8Array([1, 2, 4]);
    expect(await sha256Bytes(first)).not.toBe(await sha256Bytes(changed));
    expect(await sha256Blob(new Blob([first]))).toBe(await sha256Bytes(first));
  });
  it('versionne et lie le manifeste au digest des octets', () => {
    const manifest = JSON.parse(evidenceManifestV1({
      caption: 'Publicite', platform: 'instagram', mediaType: 'image', mediaSha256: 'a'.repeat(64),
    }));
    expect(manifest).toEqual({
      version: 1, caption: 'Publicite', platform: 'instagram', mediaType: 'image', mediaSha256: 'a'.repeat(64),
    });
  });
  it('refuse un blob altere ou une empreinte malformee', async () => {
    const original = new Blob(['abc']);
    const altered = new Blob(['abd']);
    const expected = await sha256Blob(original);
    expect(await verifyBlobSha256(original, expected)).toBe(true);
    expect(await verifyBlobSha256(altered, expected)).toBe(false);
    expect(await verifyBlobSha256(original, 'not-a-hash')).toBe(false);
    expect(await verifyBlobSha256(original, expected.toUpperCase())).toBe(false);
  });
});
