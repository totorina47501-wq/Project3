import {describe,it,expect} from 'vitest';
import {isSameOrigin} from '../../lib/security/origin';
describe('Protection CSRF des écritures médias',()=>{
  it('autorise la même origine',()=>{
    const request=new Request('https://mentioncheck.test/api/media/remove',
      {headers:{origin:'https://mentioncheck.test'}});
    expect(isSameOrigin(request)).toBe(true);
  });
  it('rejette une origine tierce',()=>{
    const request=new Request('https://mentioncheck.test/api/media/prepare',
      {headers:{origin:'https://elsewhere.test'}});
    expect(isSameOrigin(request)).toBe(false);
  });
});
