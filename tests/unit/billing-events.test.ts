import { describe, expect, it } from 'vitest';
import { paidPlanFromPrices, effectivePlan, subscriptionAccessTier, stripeStatus, subscriptionPeriodEnd } from '../../lib/billing/events';
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
    expect(effectivePlan('past_due','studio')).toBe('free');
    expect(effectivePlan('canceled','pro')).toBe('free');
    expect(effectivePlan('active',null)).toBe('free');
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
it('ne confond pas le compte gratuit et Solo payé, même si le profil historique est Solo',()=>{
  const now = Date.parse('2026-11-10T10:00:00Z');
  expect(subscriptionAccessTier(null, now)).toBe('free');
  const subscribed = {stripe_subscription_id:'sub_sandbox',plan:'solo' as const,status:'active',current_period_end:'2026-12-10T00:00:00Z'};
  expect(subscriptionAccessTier(subscribed, now)).toBe('solo');
  expect(subscriptionAccessTier({...subscribed,status:'past_due'}, now)).toBe('free');
  expect(subscriptionAccessTier({...subscribed,status:'canceled'}, now)).toBe('free');
  expect(subscriptionAccessTier({...subscribed,current_period_end:'2026-11-01T00:00:00Z'}, now)).toBe('free');
  expect(subscriptionAccessTier({...subscribed,stripe_subscription_id:null}, now)).toBe('free');
  expect(subscriptionAccessTier({...subscribed,current_period_end:null}, now)).toBe('free');
});
