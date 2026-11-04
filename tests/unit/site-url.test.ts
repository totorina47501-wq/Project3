import { describe, it, expect } from 'vitest';
import { publicSiteUrl } from '../../lib/site-url';
describe('URLs publiques sécurisées',()=>{
  it('utilise le domaine Cloudflare si aucune URL n est vérifiée',()=>{
    const previous=process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(publicSiteUrl()).toBe('https://mentioncheck.toto-rina47501.workers.dev');
    if(previous)process.env.NEXT_PUBLIC_APP_URL=previous;
  });
  it('ignore les schémas non sécurisés',()=>{
    const previous=process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL='javascript:alert(1)';
    expect(publicSiteUrl()).toContain('workers.dev');
    if(previous)process.env.NEXT_PUBLIC_APP_URL=previous;
    else delete process.env.NEXT_PUBLIC_APP_URL;
  });
});
