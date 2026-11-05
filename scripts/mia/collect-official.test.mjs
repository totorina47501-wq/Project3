import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { collectOfficialCandidates, discoverFromSitemap, validateOfficialUrl } from '../../scripts/mia/collect-official.mjs';

function assertExpect(actual) {
  return {
    toBeNull: () => assert.equal(actual, null),
    toBe: expected => assert.equal(actual, expected),
    toEqual: expected => assert.deepEqual(actual, expected),
    toHaveLength: expected => assert.equal(actual.length, expected),
    toThrow: () => assert.throws(actual),
    rejects: { toThrow: async () => assert.rejects(actual) },
  };
}
describe('collecteur juridique hors ligne', () => {
  it('refuse les hôtes trompeurs et les liens non HTTPS', () => {
    assertExpect(validateOfficialUrl('https://www.legifrance.gouv.fr.evil.test/a')).toBeNull();
    assertExpect(validateOfficialUrl('http://www.cnil.fr/a')).toBeNull();
    assertExpect(validateOfficialUrl('https://www.cnil.fr/a')).toBe('https://www.cnil.fr/a');
  });
  it('déduplique et ignore les liens non officiels', () => {
    assertExpect(discoverFromSitemap('<urlset><url><loc>https://www.cnil.fr/fr/guide</loc></url><url><loc>https://www.cnil.fr/fr/guide</loc></url><url><loc>https://evil.test/</loc></url></urlset>')).toEqual(['https://www.cnil.fr/fr/guide']);
  });
  it('produit des candidats à valider sans ingestion automatique', async () => {
    let called = 0;
    const fetcher = async () => { called++; return ({ ok:true,status:200,
      headers:new Headers(),text:async()=>'<urlset><url><loc>https://www.economie.gouv.fr/guide</loc></url></urlset>' }); };
    const result = await collectOfficialCandidates({ feeds:['https://www.economie.gouv.fr/sitemap.xml'],fetcher });
    assertExpect(result).toHaveLength(1);
    assertExpect(result[0]?.status).toBe('pending_review');
    assertExpect(result[0]?.fingerprint).toHaveLength(64);
    assert.equal(called,1);
  });
  it('rejette les redirections et les entités XML', async () => {
    const fetcher = async () => ({ok:false,status:302,headers:new Headers(),text:async()=>''});
    await assertExpect(collectOfficialCandidates({feeds:['https://www.cnil.fr/sitemap.xml'],fetcher})).rejects.toThrow();
    assertExpect(()=>discoverFromSitemap('<!DOCTYPE foo><urlset/>')).toThrow();
  });
});
