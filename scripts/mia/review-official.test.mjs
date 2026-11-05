import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { inspectOfficialHtml, reviewOfficialCandidates } from './review-official.mjs';

describe('revue documentaire sans publication', () => {
  it('conserve le statut en attente et calcule une empreinte stable', () => {
    const result = inspectOfficialHtml('<title>Concours</title><main>Règles des concours</main>', 'https://www.cnil.fr/fr/concours');
    assert.equal(result.status, 'pending_review');
    assert.equal(result.approved, false);
    assert.equal(result.title, 'Concours');
    assert.equal(result.contentSha256.length, 64);
  });
  it('refuse une redirection sans la suivre', async () => {
    const fetcher = async (_url, options) => {
      assert.equal(options.redirect, 'manual');
      return { status: 302, ok: false, headers: new Headers() };
    };
    const result = await reviewOfficialCandidates([{url:'https://www.cnil.fr/fr/concours'}], {fetcher});
    assert.equal(result[0].status, 'fetch_failed');
  });
  it('déduplique et borne les pages téléchargées', async () => {
    let calls = 0;
    const fetcher = async () => {
      calls++;
      return new Response('<title>Règles</title><p>Concours</p>', {
        headers: {'content-type':'text/html'} });
    };
    const result = await reviewOfficialCandidates([
      {url:'https://www.cnil.fr/fr/concours'}, {url:'https://www.cnil.fr/fr/concours'},
      {url:'https://example.org/unsafe'},
    ], {fetcher});
    assert.equal(calls,1);
    assert.equal(result.length,1);
    assert.equal(result[0].approved,false);
  });
  it('rejette les réponses volumineuses', async () => {
    const fetcher = async () => new Response('a'.repeat(300_001), {headers:{'content-type':'text/html'}});
    const result = await reviewOfficialCandidates([{url:'https://www.cnil.fr/fr/concours'}],{fetcher});
    assert.equal(result[0].status,'fetch_failed');
  });
});
