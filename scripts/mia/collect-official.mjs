// Collecte de découvertes documentaires, jamais de publication automatique dans Mia.
// Utiliser les flux XML explicitement approuvés ; pas de scraping ni de texte juridique inventé.
import { createHash } from 'node:crypto';

export const OFFICIAL_HOSTS = new Set([
  'www.legifrance.gouv.fr', 'www.economie.gouv.fr', 'www.cnil.fr', 'eur-lex.europa.eu',
]);

export function validateOfficialUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        !OFFICIAL_HOSTS.has(url.hostname) || url.href.length > 2048) return null;
    url.hash = '';
    return url.href;
  } catch { return null; }
}

export function discoverFromSitemap(xml, max = 500) {
  if (typeof xml !== 'string' || xml.length > 2_000_000) throw new Error('Flux trop volumineux');
  if (/<(?:!DOCTYPE|!ENTITY)/i.test(xml)) throw new Error('XML non autorisé');
  const candidates = [];
  const pattern = /<loc(?:\s[^>]*)?>\s*([^<]{1,2048})\s*<\/loc>/gi;
  for (const match of xml.matchAll(pattern)) {
    const decoded = match[1].replace(/&amp;/g, '&').trim();
    const url = validateOfficialUrl(decoded);
    if (url && !url.toLowerCase().endsWith('.xml') && !candidates.includes(url)) {
      candidates.push(url);
      if (candidates.length >= max) break;
    }
  }
  return candidates;
}

export async function collectOfficialCandidates({ feeds, fetcher = fetch, max = 500 }) {
  if (!Array.isArray(feeds) || feeds.length === 0 || feeds.length > 8) throw new Error('Flux invalides');
  const results = new Map();
  for (const feed of feeds) {
    const trusted = validateOfficialUrl(feed);
    if (!trusted || !new URL(trusted).pathname.endsWith('.xml')) throw new Error('Flux non approuvé');
    const response = await fetcher(trusted, { redirect: 'manual', signal: AbortSignal.timeout(10000),
      headers: { Accept: 'application/xml, text/xml' } });
    if (!response.ok || response.status >= 300) throw new Error('Flux indisponible');
    const length = Number(response.headers.get('content-length') ?? 0);
    if (length > 2_000_000) throw new Error('Flux trop volumineux');
    const xml = await response.text();
    for (const url of discoverFromSitemap(xml, max)) {
      if (results.size >= max) break;
      results.set(url, { url, sourceHost: new URL(url).hostname,
        fingerprint: createHash('sha256').update(url).digest('hex'), status: 'pending_review' });
    }
  }
  return [...results.values()].sort((a, b) => a.url.localeCompare(b.url));
}
