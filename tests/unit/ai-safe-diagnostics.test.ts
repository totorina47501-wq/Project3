import { expect,it } from 'vitest';
import { aiFailureDetails } from '../../lib/ai/failure';
it('expose seulement catégorie, code fournisseur autorisé et statut borné',()=>{
  expect(aiFailureDetails({status:400,code:'invalid_image_url',message:'https://private.test/?token=secret'})).toEqual({category:'request',providerCode:'invalid_image_url',providerStatus:400});
  const unsafe=aiFailureDetails({status:Infinity,code:'sk-proj-secret',kind:'Texte privé',message:'légende privée'});
  expect(unsafe).toEqual({category:'unknown'});expect(JSON.stringify(unsafe)).not.toContain('secret');
});
