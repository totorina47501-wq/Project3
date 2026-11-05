import { describe, expect, it } from 'vitest';
import { billingGate, paidPriceId, isBillableStatus } from '../../lib/billing/config';
const testEnv = {
  BILLING_ENABLED:'true', STRIPE_MODE:'test',
  STRIPE_SECRET_KEY:'sk_test_placeholder_only',
  STRIPE_WEBHOOK_SECRET:'whsec_placeholder_only',
  STRIPE_PRICE_PRO:'price_A1', STRIPE_PRICE_STUDIO:'price_B2',
};
describe('Facturation Stripe désactivée par défaut', () => {
  it('prépare Solo sans créer de client si son tarif est absent ou ambigu',()=>{
    expect(()=>paidPriceId('solo',billingGate(testEnv))).toThrow();
    const gate=billingGate({...testEnv,STRIPE_PRICE_SOLO:'price_C3'});
    expect(paidPriceId('solo',gate)).toBe('price_C3');
    expect(billingGate({...testEnv,STRIPE_PRICE_SOLO:'price_A1'}).enabled).toBe(false);
    expect(()=>paidPriceId('admin' as 'solo',gate)).toThrow();
  });
  it('n active jamais un checkout sans opt-in',()=>{
    expect(billingGate({}).enabled).toBe(false);
    expect(billingGate({STRIPE_SECRET_KEY:'sk_test_demo'}).enabled).toBe(false);
  });
  it('refuse toute clé Stripe de production même si flag actif',()=>{
    expect(billingGate({...testEnv,STRIPE_SECRET_KEY:'sk_live_abcdef'}).enabled).toBe(false);
    expect(billingGate({...testEnv,STRIPE_MODE:'live'}).enabled).toBe(false);
  });
  it('demande la signature du webhook et des tarifs de test',()=>{
    expect(billingGate({...testEnv,STRIPE_WEBHOOK_SECRET:''}).enabled).toBe(false);
    expect(billingGate({...testEnv,STRIPE_PRICE_PRO:''}).enabled).toBe(false);
  });
  it('associe uniquement des plans autorisés au prix explicite',()=>{
    const gate=billingGate(testEnv);
    expect(gate.enabled).toBe(true);
    expect(paidPriceId('pro',gate)).toBe('price_A1');
    expect(paidPriceId('studio',gate)).toBe('price_B2');
    expect(isBillableStatus('active')).toBe(true);
    expect(isBillableStatus('trialing')).toBe(true);
    expect(isBillableStatus('past_due')).toBe(false);
  });
});
