import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { planApprovedImport } from './plan-approved-import.mjs';

const content = 'Synthèse juridique validée et datée par un responsable éditorial.';
const source_url = 'https://www.legifrance.gouv.fr/loda/id/TEST';
const doc = {
  article_ref: 'LTEST-1', content, source_url, effective_on: '2026-11-05',
  content_sha256: createHash('sha256').update(content).digest('hex'),
  source_sha256: 'a'.repeat(64), reviewed_by: 'reviewer',
  reviewed_at: '2026-11-05T12:00:00Z',
};
const manifest = { schemaVersion: 1, status: 'approved_for_manual_import', documents: [doc] };
describe('approved import dry run', () => {
  it('marks new entries for insertion', () => {
    const result = planApprovedImport(manifest, []);
    assert.equal(result.inserts, 1);
    assert.equal(result.operations[0].requires_embedding, true);
  });
  it('leaves unchanged entries untouched', () => {
    const result = planApprovedImport(manifest, [doc]);
    assert.equal(result.unchanged, 1);
    assert.equal(result.operations[0].requires_embedding, false);
  });
  it('marks changed content for reindexation', () => {
    const result = planApprovedImport(manifest, [{...doc, content: 'Earlier content'}]);
    assert.equal(result.updates, 1);
  });
  it('refuses changed official URL for an existing reference', () => {
    assert.throws(() => planApprovedImport(manifest, [{
      ...doc, source_url: 'https://www.economie.gouv.fr/autre',
    }]));
  });
  it('refuses forged digests, duplicate refs and unsupported hosts', () => {
    assert.throws(() => planApprovedImport({...manifest, documents:[{...doc, content_sha256:'b'.repeat(64)}]}, []));
    assert.throws(() => planApprovedImport({...manifest, documents:[doc,doc]}, []));
    const other = {...doc, source_url:'https://www.cnil.fr/fr/test'};
    assert.throws(() => planApprovedImport({...manifest, documents:[other]}, []));
  });
});
