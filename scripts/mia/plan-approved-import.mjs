// Deterministic, read-only import planner; no Supabase or OpenAI calls.
import { createHash } from 'node:crypto';
import { validateOfficialUrl } from './collect-official.mjs';

const SHA = /^[a-f0-9]{64}$/;
const REF = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/;
const INDEXABLE_HOSTS = new Set(['www.legifrance.gouv.fr', 'www.economie.gouv.fr']);
const hash = (value) => createHash('sha256').update(value).digest('hex');

function assertDocument(doc) {
  const url = typeof doc?.source_url === 'string' ? validateOfficialUrl(doc.source_url) : null;
  if (!url || url !== doc.source_url || !INDEXABLE_HOSTS.has(new URL(url).hostname) ||
      typeof doc.article_ref !== 'string' || !REF.test(doc.article_ref) ||
      typeof doc.content !== 'string' || doc.content.trim().length < 20 ||
      doc.content.length > 2000 || doc.content !== doc.content.trim() ||
      !SHA.test(doc.content_sha256 ?? '') || doc.content_sha256 !== hash(doc.content) ||
      !SHA.test(doc.source_sha256 ?? '') ||
      typeof doc.reviewed_by !== 'string' || doc.reviewed_by.trim().length < 3 || doc.reviewed_by.length > 120 ||
      typeof doc.reviewed_at !== 'string' || !Number.isFinite(Date.parse(doc.reviewed_at)) ||
      typeof doc.effective_on !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(doc.effective_on) ||
      new Date(doc.effective_on + 'T00:00:00Z').toISOString().slice(0, 10) !== doc.effective_on)
    throw new Error('Approved document failed validation');
}

export function planApprovedImport(manifest, existing) {
  if (manifest?.schemaVersion !== 1 || manifest.status !== 'approved_for_manual_import' ||
      !Array.isArray(manifest.documents) || manifest.documents.length > 500 ||
      !Array.isArray(existing) || existing.length > 1000)
    throw new Error('Invalid corpus inputs');
  const current = new Map();
  for (const doc of existing) {
    if (typeof doc?.article_ref !== 'string' || !REF.test(doc.article_ref) ||
        typeof doc.content !== 'string' || typeof doc.source_url !== 'string' ||
        current.has(doc.article_ref)) throw new Error('Invalid current corpus');
    current.set(doc.article_ref, doc);
  }
  const refs = new Set();
  const operations = [];
  for (const doc of manifest.documents) {
    assertDocument(doc);
    if (refs.has(doc.article_ref)) throw new Error('Duplicate approved reference');
    refs.add(doc.article_ref);
    const old = current.get(doc.article_ref);
    if (old && old.source_url !== doc.source_url)
      throw new Error('Source URL changed for an existing reference');
    const action = !old ? 'insert' : old.content === doc.content &&
      (old.effective_on ?? null) === doc.effective_on ? 'unchanged' : 'update';
    operations.push({
      article_ref: doc.article_ref, action, source_url: doc.source_url,
      content_sha256: doc.content_sha256, requires_embedding: !old || old.content !== doc.content,
    });
  }
  return {
    dryRun: true, existingCount: existing.length,
    inserts: operations.filter(op => op.action === 'insert').length,
    updates: operations.filter(op => op.action === 'update').length,
    unchanged: operations.filter(op => op.action === 'unchanged').length,
    operations, warning: 'Read-only plan. No changes have been applied to Supabase.',
  };
}
