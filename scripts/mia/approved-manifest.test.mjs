import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildApprovedManifest } from './approved-manifest.mjs';

const url = 'https://www.legifrance.gouv.fr/loda/id/TEST';
const sha = 'a'.repeat(64);
const reviewed = [{ url, contentSha256: sha, status: 'pending_review' }];
const approval = {
  url, contentSha256: sha, articleRef: 'LTEST-1',
  content: 'Synthèse juridique vérifiée manuellement à partir de la source officielle.',
  effectiveOn: '2026-11-05', reviewer: 'legal-reviewer',
  reviewedAt: '2026-11-05T12:00:00Z',
};

describe('manual approval manifest', () => {
  it('builds an auditable document without importing it', () => {
    const manifest = buildApprovedManifest(reviewed, [approval]);
    assert.equal(manifest.documents.length, 1);
    assert.equal(manifest.documents[0].article_ref, 'LTEST-1');
    assert.equal(manifest.documents[0].content_sha256.length, 64);
    assert.equal(manifest.status, 'approved_for_manual_import');
  });
  it('refuses a mismatching review digest', () => {
    assert.throws(() => buildApprovedManifest(reviewed, [
      { ...approval, contentSha256: 'b'.repeat(64) },
    ]));
  });
  it('requires a reviewer', () => {
    assert.throws(() => buildApprovedManifest(reviewed, [
      { ...approval, reviewer: '' },
    ]));
  });
  it('refuses duplicate article references', () => {
    const second = 'https://www.legifrance.gouv.fr/loda/id/TEST2';
    assert.throws(() => buildApprovedManifest(
      [...reviewed, { url: second, contentSha256: sha, status: 'pending_review' }],
      [approval, { ...approval, url: second }],
    ));
  });
  it('accepts multiple references from the same official source URL', () => {
    const manifest = buildApprovedManifest(reviewed, [
      approval,
      {
        ...approval,
        articleRef: 'LTEST-2',
        content: 'Seconde synthèse juridique validée, tirée de la même source officielle.',
      },
    ]);
    assert.equal(manifest.documents.length, 2);
    assert.equal(manifest.documents[0]?.source_url, manifest.documents[1]?.source_url);
  });
  it('refuses duplicate approvals using the same article reference', () => {
    assert.throws(() => buildApprovedManifest(reviewed, [approval, approval]));
  });
  it('rejects invalid calendar dates, short text and unknown sources', () => {
    assert.throws(() => buildApprovedManifest(reviewed, [
      { ...approval, effectiveOn: '2026-02-30' },
    ]));
    assert.throws(() => buildApprovedManifest(reviewed, [
      { ...approval, content: 'short' },
    ]));
    assert.throws(() => buildApprovedManifest([], [approval]));
  });
});
