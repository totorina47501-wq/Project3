import { HttpError } from '@/lib/security/auth';

// Content-Length seul n'est pas fiable (chunked/proxy). La lecture est bornée.
export async function readPrivacyJson(request: Request, limit = 2048): Promise<unknown> {
  const length = request.headers.get('content-length');
  if (length && Number(length) > limit) throw new HttpError(413, 'Corps de requête trop volumineux.');
  if (!request.body) throw new HttpError(400, 'JSON invalide.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new HttpError(413, 'Corps de requête trop volumineux.');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal:true }).decode(bytes)); }
  catch { throw new HttpError(400, 'JSON invalide.'); }
}
