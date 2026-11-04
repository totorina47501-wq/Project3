import { describe, expect, it } from 'vitest';
import { renderEmail, emailPreviews } from '../../lib/email/templates';
describe('Emails français préparés sans envoi',()=>{
  it('rend les quatre messages en HTML et texte autonome',()=>{
    const previews=emailPreviews('https://local.test');
    expect(previews).toHaveLength(4);
    for(const preview of previews){
      expect(preview.email.html).toContain('<html lang="fr">');
      expect(preview.email.subject).not.toMatch(/[\r\n]/);
      expect(preview.email.text).toContain('MentionCheck');
      expect(preview.email.html).toContain('https://local.test/dashboard');
    }
    expect(previews.find(p=>p.name==='erasure-received')?.email.text).toContain('aucune suppression');
  });
  it('échappe les données et ne permet pas de fabriquer un lien extérieur',()=>{
    const email=renderEmail({kind:'welcome',name:'<img src=x onerror=alert(1)>',siteOrigin:'https://local.test'});
    expect(email.html).toContain('&lt;img');expect(email.html).not.toContain('<img');
    for(const siteOrigin of ['javascript:alert(1)','http://evil.test','https://me:pass@evil.test','https://local.test/path'])
      expect(()=>renderEmail({kind:'welcome',name:'A',siteOrigin})).toThrow();
    expect(()=>renderEmail({kind:'report-ready',verificationId:'../outside',siteOrigin:'https://local.test'})).toThrow();
  });
  it('borne les variables sans accepter un faux quota',()=>{
    expect(()=>renderEmail({kind:'welcome',name:'x'.repeat(201),siteOrigin:'https://local.test'})).toThrow();
    expect(()=>renderEmail({kind:'quota-warning',used:-1,limit:3,periodEnd:'2026-12-01',siteOrigin:'https://local.test'})).toThrow();
  });
});
