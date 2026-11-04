// Authentifie un lot local sans exposer la clé stable d’identification HMAC.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { lstat, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export async function privateRead(path, maxBytes = 20 * 1024 * 1024) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size > maxBytes || (process.platform !== 'win32' && (info.mode & 0o077))) throw new Error('Fichier local privé requis.');
  const bytes = await readFile(path);
  if (bytes.length !== info.size || bytes.length > maxBytes) throw new Error('Fichier modifié pendant la lecture.');
  return bytes;
}
export async function readKey(path) {
  const key = await privateRead(path, 4096);
  if (key.length < 32) throw new Error('Clé locale insuffisante.');
  return key;
}
function signature(manifestBytes, report, key) {
  return createHmac('sha256', key).update(JSON.stringify({ version: 1, manifestSha256: sha256(manifestBytes), report })).digest('hex');
}
export async function signDataset(output, manifestBytes, report, key) {
  await writeFile(join(output, 'integrity.json'), JSON.stringify({ version: 1, hmac: signature(manifestBytes, report, key) }), { mode: 0o600, flag: 'wx' });
}
export function verifySignature(manifestBytes, report, integrity, key) {
  if (integrity?.version !== 1 || !/^[a-f0-9]{64}$/.test(integrity.hmac ?? '')) return false;
  return timingSafeEqual(Buffer.from(signature(manifestBytes, report, key), 'hex'), Buffer.from(integrity.hmac, 'hex'));
}
