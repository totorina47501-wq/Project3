import {describe,expect,it} from 'vitest';
import {selectExpiredMedia,validateOwnedMediaPath,PENDING_GRACE_MS} from '../../lib/media/retention';
const user='33333333-3333-4333-8333-333333333333';
const id='44444444-4444-4444-8444-444444444444';
const path=user+'/'+id+'.mp4';
const now=Date.parse('2026-11-04T12:00:00Z');
const row={id,user_id:user,storage_path:path,status:'ready',
  expires_at:'2026-11-03T12:00:00Z'};
describe('Purge des médias avec absence de crédits IA',()=>{
  it('refuse les chemins qui ne sont pas possédés par le compte',()=>{
    expect(validateOwnedMediaPath(row)).toBe(true);
    expect(validateOwnedMediaPath({...row,storage_path:'../private.mp4'})).toBe(false);
    expect(validateOwnedMediaPath({...row,user_id:id})).toBe(false);
  });
  it('conserve les preuves référencées par une vérification',()=>{
    expect(selectExpiredMedia([row],new Set([path]),now)).toHaveLength(0);
  });
  it('ne supprime pas les éléments encore valides',()=>{
    expect(selectExpiredMedia([{...row,expires_at:'2026-11-10T12:00:00Z'}],new Set(),now))
      .toHaveLength(0);
  });
  it('ajoute une marge après expiration des jetons d upload signés',()=>{
    const pending={...row,status:'pending'};
    expect(selectExpiredMedia([pending],new Set(),
      Date.parse(pending.expires_at)+PENDING_GRACE_MS-1)).toHaveLength(0);
    expect(selectExpiredMedia([pending],new Set(),now)).toHaveLength(1);
  });
  it('sélectionne un média prêt et réellement expiré',()=>{
    expect(selectExpiredMedia([row],new Set(),now)).toHaveLength(1);
  });
});
