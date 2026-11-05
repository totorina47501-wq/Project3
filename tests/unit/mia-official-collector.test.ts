import { describe, expect, it, vi } from 'vitest';
import { collectOfficialCandidates, discoverFromSitemap, validateOfficialUrl } from '../../scripts/mia/collect-official.mjs';

describe('collecteur juridique hors ligne', () => {
  it('refuse les hôtes trompeurs et les liens non HTTPS', () => {
    expect(validateOfficialUrl('https://www.legifrance.gouv.fr.evil.test/a')).toBeNull();
    expect(validateOfficialUrl('http://www.cnil.fr/a')).toBeNull();
    expect(validateOfficialUrl('https://www.cnil.fr/a')).toBe('https://www.cnil.fr/a');
  });
  it('déduplique et ignore les liens non officiels', () => {
    expect(discoverFromSitemap('<urlset><url><loc>https://www.cnil.fr/fr/guide</loc></url><url><loc>https://www.cnil.fr/fr/guide</loc></url><url><loc>https://evil.test/</loc></url></urlset>')).toEqual(['https://www.cnil.fr/fr/guide']);
  });
  it('produit des candidats à valider sans ingestion automatique', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok:true,status:200,
      headers:new Headers(),text:async()=>'<urlset><url><loc>https://www.economie.gouv.fr/guide</loc></url></urlset>' });
    const result = await collectOfficialCandidates({ feeds:['https://www.economie.gouv.fr/sitemap.xml'],fetcher });
    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe('pending_review');
    expect(result[0]?.fingerprint).toHaveLength(64);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('rejette les redirections et les entités XML', async () => {
    const fetcher = vi.fn().mockResolvedValue({ok:false,status:302,headers:new Headers(),text:async()=>''});
    await expect(collectOfficialCandidates({feeds:['https://www.cnil.fr/sitemap.xml'],fetcher})).rejects.toThrow();
    expect(()=>discoverFromSitemap('<!DOCTYPE foo><urlset/>')).toThrow();
  });
});
