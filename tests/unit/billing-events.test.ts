import { describe, expect, it } from 'vitest';
import { paidPlanFromPrices, effectivePlan, stripeStatus } from '../../lib/billing/events';
const config={pro:'price_PRO',studio:'price_STUDIO'};
describe('Droits Stripe test — sans appel API',()=>{
  it('reconnaît Solo configuré et refuse une collision de tarifs',()=>{
    expect(paidPlanFromPrices(['price_SOLO'],{...config,solo:'price_SOLO'})).toBe('solo');
    expect(paidPlanFromPrices(['price_PRO'],{...config,solo:'price_PRO'})).toBeNull();
  });
  it('ne déduit jamais le plan de metadata client arbitraire',()=>{
    expect(paidPlanFromPrices(['price_unknown'],config)).toBe(null);
    expect(paidPlanFromPrices(['price_PRO','price_STUDIO'],config)).toBe(null);
    expect(paidPlanFromPrices(['price_PRO'],config)).toBe('pro');
  });
  it('enlève les droits payants après fin ou impayé',()=>{
    expect(effectivePlan('active','studio')).toBe('studio');
    expect(effectivePlan('past_due','studio')).toBe('solo');
    expect(effectivePlan('canceled','pro')).toBe('solo');
    expect(effectivePlan('active',null)).toBe('solo');
  });
  it('n invente aucun état de facturation',()=>{
    expect(stripeStatus('active')).toBe('active');
    expect(stripeStatus('malformed')).toBe('incomplete');
  });
});
