// Vérification non destructive de candidats. Aucun texte collecté n'est publié dans Mia.
import { createHash } from 'node:crypto';
import { validateOfficialUrl } from './collect-official.mjs';

const MAX_BYTES = 300_000;
export function inspectOfficialHtml(html, url) {
  if (typeof html !== 'string' || html.length > MAX_BYTES) throw new Error('Document trop volumineux');
  const title = html.match(/<title\b[^>]*>([^<]{1,300})<\/title>/i)?.[1]
    ?.replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim() ?? '';
  const description = html.match(/<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']{1,500})["']/i)?.[1] ?? '';
  const text = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ').replace(/&(?:nbsp|amp|quot);/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, 4000);
  return { url, title, description, preview: text, contentSha256: createHash('sha256').update(text).digest('hex'),
    status: 'pending_review', approved: false };
}

export async function reviewOfficialCandidates(candidates, { fetcher = fetch, max = 20 } = {}) {
  if (!Array.isArray(candidates) || candidates.length > 500) throw new Error('Liste invalide');
  const output = [];
  const seen = new Set();
  for (const candidate of candidates.slice(0, Math.min(max, 20))) {
    const url = typeof candidate?.url === 'string' ? validateOfficialUrl(candidate.url) : null;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    try {
      const response = await fetcher(url, { redirect: 'manual', signal: AbortSignal.timeout(10000),
        headers: { Accept: 'text/html' } });
      if (response.status !== 200 || !response.ok) throw new Error('Réponse non valide');
      const type = response.headers.get('content-type') ?? '';
      if (!/^text\/html(?:\s*;|$)/i.test(type)) throw new Error('Type non pris en charge');
      if (Number(response.headers.get('content-length') ?? 0) > MAX_BYTES) throw new Error('Taille dépassée');
      // Limiter réellement les octets lus, même sans en-tête Content-Length.
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Corps indisponible');
      const parts = []; let bytes = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > MAX_BYTES) throw new Error('Taille dépassée');
          parts.push(value);
        }
      } finally { await reader.cancel().catch(() => {}); }
      const buffer = new Uint8Array(bytes);
      let offset = 0;
      for (const part of parts) { buffer.set(part, offset); offset += part.byteLength; }
      output.push(inspectOfficialHtml(new TextDecoder().decode(buffer), url));
    } catch {
      output.push({ url, status: 'fetch_failed', approved: false });
    }
  }
  return output;
}
