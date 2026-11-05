// Manual validation of reviewed official pages. No database writes or embeddings.
import { createHash } from 'node:crypto';
import { validateOfficialUrl } from './collect-official.mjs';

const REF = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/;
const SHA = /^[a-f0-9]{64}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value) {
  if (typeof value !== 'string' || !DATE.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function buildApprovedManifest(reviewed, approvals) {
  if (!Array.isArray(reviewed) || !Array.isArray(approvals) || reviewed.length > 500 ||
      approvals.length > 500) throw new Error('Invalid approval inputs');
  const byUrl = new Map();
  for (const item of reviewed) {
    const url = typeof item?.url === 'string' ? validateOfficialUrl(item.url) : null;
    if (!url || url !== item.url || byUrl.has(url)) throw new Error('Ambiguous review');
    byUrl.set(url, item);
  }
  const seenUrls = new Set();
  const seenRefs = new Set();
  const documents = [];
  for (const approval of approvals) {
    const { url, contentSha256, articleRef, content, effectiveOn, reviewer, reviewedAt } = approval ?? {};
    const trusted = typeof url === 'string' ? validateOfficialUrl(url) : null;
    if (!trusted || trusted !== url || seenUrls.has(url)) throw new Error('Invalid or repeated URL');
    seenUrls.add(url);
    const original = byUrl.get(url);
    if (!original || original.status !== 'pending_review' ||
        original.contentSha256 !== contentSha256 || !SHA.test(contentSha256 ?? ''))
      throw new Error('Review fingerprint mismatch');
    if (typeof articleRef !== 'string' || !REF.test(articleRef) || seenRefs.has(articleRef))
      throw new Error('Invalid or repeated article reference');
    seenRefs.add(articleRef);
    if (typeof content !== 'string' || content.trim().length < 20 || content.length > 2000 ||
        !validDate(effectiveOn) ||
        typeof reviewer !== 'string' || reviewer.trim().length < 3 || reviewer.length > 120 ||
        typeof reviewedAt !== 'string' || !Number.isFinite(Date.parse(reviewedAt)))
      throw new Error('Missing legal approval details');
    const legalText = content.trim();
    documents.push({
      article_ref: articleRef, content: legalText, source_url: url,
      effective_on: effectiveOn,
      content_sha256: createHash('sha256').update(legalText).digest('hex'),
      source_sha256: contentSha256,
      reviewed_by: reviewer.trim(), reviewed_at: reviewedAt,
    });
  }
  return {
    schemaVersion: 1, status: 'approved_for_manual_import', documents,
    notice: 'No automatic ingestion, Supabase writes or OpenAI usage.',
  };
}
