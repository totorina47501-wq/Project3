import { describe, expect, it } from 'vitest';
import { socialAccountSchema, preferenceSchema, socialPage, SOCIAL_COLUMNS } from '../../lib/social/model';
import { readBoundedJson } from '../../lib/social/server';

describe('Paramètres sociaux internes',()=>{
  it('normalise un identifiant déclaré et refuse liens, propriétés sensibles et corps trop longs',()=>{
    expect(socialAccountSchema.parse({platform:'instagram',handle:' @Créatrice.fr '})).toEqual({platform:'instagram',handle:'créatrice.fr'});
    for(const item of [{platform:'other',handle:'ok'},{platform:'tiktok',handle:'https://t.test/a'},{platform:'youtube',handle:'two names'},{platform:'linkedin',handle:'x'.repeat(201)},{platform:'instagram',handle:'ok',plan:'studio'},{platform:'instagram',handle:'ok',access_token_vault_id:'secret'}])
      expect(socialAccountSchema.safeParse(item).success).toBe(false);
    expect(SOCIAL_COLUMNS).not.toContain('vault');
  });
  it('borne la pagination et refuse une préférence ou un plan non autorisé',()=>{
    expect(socialPage(new Request('https://local.test/api/social-accounts'))).toBe(1);
    expect(()=>socialPage(new Request('https://local.test/api/social-accounts?page=-1'))).toThrow();
    expect(preferenceSchema.parse({rewriteTone:'créatif'})).toEqual({rewriteTone:'créatif'});
    for(const value of [{rewriteTone:'secret'},{rewriteTone:'naturel',plan:'pro'}])expect(preferenceSchema.safeParse(value).success).toBe(false);
  });
  it('refuse origine tierce, JSON invalide et corps excessif avant toute mutation',async()=>{
    const request=(body:string,origin='https://local.test')=>new Request('https://local.test/api/social-accounts',{method:'POST',headers:{origin},body});
    await expect(readBoundedJson(request('{}','https://evil.test'))).rejects.toMatchObject({status:403});
    await expect(readBoundedJson(request('{'))).rejects.toMatchObject({status:400});
    await expect(readBoundedJson(request('x'.repeat(2049)))).rejects.toMatchObject({status:413});
  });
});
