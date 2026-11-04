import { describe, expect, it } from 'vitest';
import { readPrivacyJson } from '../../lib/privacy/request';

describe('Corps des mutations RGPD', () => {
  it('borne réellement les octets même sans Content-Length', async () => {
    await expect(readPrivacyJson(new Request('https://local.test',{method:'POST',body:JSON.stringify({text:'a'.repeat(2100)})}))).rejects.toMatchObject({status:413});
  });
  it('autorise une limite explicite sans changer le défaut RGPD',async()=>{
    const body=JSON.stringify({text:'a'.repeat(3000)});
    await expect(readPrivacyJson(new Request('https://local.test',{method:'POST',body}),65536)).resolves.toEqual({text:'a'.repeat(3000)});
  });
  it('accepte un objet JSON court',async()=>{
    await expect(readPrivacyJson(new Request('https://local.test',{method:'POST',body:'{"action":"cancel"}'}))).resolves.toEqual({action:'cancel'});
  });
  it('rejette un JSON invalide sans exposer son contenu',async()=>{
    await expect(readPrivacyJson(new Request('https://local.test',{method:'POST',body:'private-invalid'}))).rejects.toMatchObject({status:400,message:'JSON invalide.'});
  });
});
