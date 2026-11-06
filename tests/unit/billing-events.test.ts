import { describe, expect, it } from 'vitest';
import { paidPlanFromPrices, effectivePlan, stripeStatus, subscriptionPeriodEnd } from '../../lib/billing/events';
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
  it('lit les périodes par item du SDK récent et conserve le format historique',()=>{
    const earlier=1_800_000_000;const later=earlier+86400;
    expect(subscriptionPeriodEnd({items:{data:[{current_period_end:later},{current_period_end:earlier}]},current_period_end:later})).toBe(new Date(earlier*1000).toISOString());
    expect(subscriptionPeriodEnd({current_period_end:earlier})).toBe(new Date(earlier*1000).toISOString());
    expect(subscriptionPeriodEnd({items:{data:[{}]},current_period_end:earlier})).toBe(new Date(earlier*1000).toISOString());
    expect(subscriptionPeriodEnd({items:{data:[{}]}})).toBeNull();
    expect(subscriptionPeriodEnd({items:{data:[{current_period_end:Infinity}]}})).toBeNull();
    expect(subscriptionPeriodEnd({current_period_end:-1})).toBeNull();
  });
});
