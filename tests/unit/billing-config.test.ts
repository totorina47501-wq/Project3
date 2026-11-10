import { describe, expect, it } from 'vitest';
import { billingGate, paidPriceId, isBillableStatus } from '../../lib/billing/config';
const testEnv = {
  BILLING_ENABLED:'true', STRIPE_MODE:'test',
  STRIPE_SECRET_KEY:'sk_test_placeholder_only',
  STRIPE_WEBHOOK_SECRET:'whsec_placeholder_only',
  STRIPE_PRICE_SOLO:'price_C3', STRIPE_PRICE_PRO:'price_A1', STRIPE_PRICE_STUDIO:'price_B2',
};
describe('Facturation Stripe désactivée par défaut', () => {
  it('prépare Solo sans créer de client si son tarif est absent ou ambigu',()=>{
    expect(()=>paidPriceId('solo',billingGate({...testEnv,STRIPE_PRICE_SOLO:''}))).toThrow();
    const gate=billingGate({...testEnv,STRIPE_PRICE_SOLO:'price_C3'});
    expect(paidPriceId('solo',gate)).toBe('price_C3');
    expect(billingGate({...testEnv,STRIPE_PRICE_SOLO:'price_A1'}).enabled).toBe(false);
    expect(()=>paidPriceId('admin' as 'solo',gate)).toThrow();
  });
  it('la réception de webhooks peut rester active quand Checkout est coupé',()=>{
    const env={...testEnv,BILLING_ENABLED:'false',STRIPE_WEBHOOK_ENABLED:'true'};
    expect(billingGate(env).enabled).toBe(false);
    expect(billingGate(env,'webhook')).toMatchObject({enabled:true,mode:'test'});
    expect(billingGate({...env,STRIPE_WEBHOOK_SECRET:''},'webhook').enabled).toBe(false);
    expect(billingGate({...env,STRIPE_SECRET_KEY:'sk_live_wrong'},'webhook').enabled).toBe(false);
  });
  it('n active jamais un checkout sans opt-in',()=>{
    expect(billingGate({}).enabled).toBe(false);
    expect(billingGate({STRIPE_SECRET_KEY:'sk_test_demo'}).enabled).toBe(false);
  });
  it('refuse toute clé Stripe de production même si flag actif',()=>{
    expect(billingGate({...testEnv,STRIPE_SECRET_KEY:'sk_live_abcdef'}).enabled).toBe(false);
    expect(billingGate({...testEnv,STRIPE_MODE:'live'}).enabled).toBe(false);
    expect(billingGate({...testEnv,STRIPE_SECRET_KEY:'sk_live_dummy',STRIPE_MODE:'live'}).enabled).toBe(false);
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
describe('Commercialisation strictement fermée par défaut',()=>{
  const validLive={...testEnv,STRIPE_MODE:'live',STRIPE_SECRET_KEY:'sk_live_fixture',
    STRIPE_LIVE_APPROVED:'true',STRIPE_LIVE_LEGAL_REGISTRATION:'123456789',
    STRIPE_LIVE_TAX_REVIEW:'approved',STRIPE_LIVE_TERMS_REVIEW:'approved',
    STRIPE_LIVE_E2E_REVIEW:'passed',
    OPENAI_PAUSED:'false',OPENAI_TEXT_ENABLED:'true',OPENAI_VISION_ENABLED:'true',OPENAI_API_KEY:'sk-proj-fixture',
    NEXT_PUBLIC_APP_URL:'https://mentioncheck.toto-rina47501.workers.dev'};
  it('exige identité vérifiée, TVA, CGV, E2E et URL production avant la moindre transaction',()=>{
    for(const key of ['STRIPE_LIVE_APPROVED','STRIPE_LIVE_LEGAL_REGISTRATION',
       'STRIPE_LIVE_TAX_REVIEW','STRIPE_LIVE_TERMS_REVIEW','STRIPE_LIVE_E2E_REVIEW',
       'NEXT_PUBLIC_APP_URL'] as const) {
      expect(billingGate({...validLive,[key]:''}).enabled).toBe(false);
    }
    expect(billingGate({...validLive,STRIPE_LIVE_LEGAL_REGISTRATION:'not-a-company'}).enabled).toBe(false);
    expect(billingGate({...validLive,STRIPE_SECRET_KEY:'sk_test_wrong'}).enabled).toBe(false);
    expect(billingGate({...validLive,STRIPE_WEBHOOK_SECRET:''}).enabled).toBe(false);
    for(const key of ['OPENAI_PAUSED','OPENAI_TEXT_ENABLED','OPENAI_VISION_ENABLED','OPENAI_API_KEY'] as const) {
      expect(billingGate({...validLive,[key]:''}).enabled).toBe(false);
    }
    expect(billingGate({...validLive,OPENAI_PAUSED:'true'}).enabled).toBe(false);
  });
  it('accepte une clé Stripe RESTREINTE rk_live_ uniquement si toutes les portes commerciales sont attestées',()=>{
    expect(billingGate({...validLive,STRIPE_SECRET_KEY:'rk_live_fixture'}))
      .toMatchObject({enabled:true,mode:'live'});
    expect(billingGate({...validLive,STRIPE_SECRET_KEY:'rk_live_fixture',BILLING_ENABLED:'false'}).enabled).toBe(false);
    expect(billingGate({...validLive,STRIPE_SECRET_KEY:'rk_live_fixture',STRIPE_LIVE_APPROVED:'false'}).enabled).toBe(false);
    expect(billingGate({...validLive,STRIPE_SECRET_KEY:'rk_live_fixture',STRIPE_WEBHOOK_SECRET:''},'webhook').enabled).toBe(false);
    expect(billingGate({...validLive,STRIPE_SECRET_KEY:'rk_test_fixture'}).enabled).toBe(false);
    expect(billingGate({...validLive,STRIPE_SECRET_KEY:'rk_live_fixture',STRIPE_LIVE_LEGAL_REGISTRATION:''}).enabled).toBe(false);
  });
  it('accepte une clé restreinte rk_test_ uniquement en sandbox et refuse un mélange de modes',()=>{
    expect(billingGate({...testEnv,STRIPE_SECRET_KEY:'rk_test_fixture'}))
      .toMatchObject({enabled:true,mode:'test'});
    expect(billingGate({...testEnv,STRIPE_SECRET_KEY:'rk_live_fixture'}).enabled).toBe(false);
    expect(billingGate({...testEnv,STRIPE_MODE:'live',STRIPE_SECRET_KEY:'rk_test_fixture'}).enabled).toBe(false);
    expect(billingGate({...testEnv,STRIPE_SECRET_KEY:'rk_test_fixture',STRIPE_WEBHOOK_SECRET:''}).enabled).toBe(false);
  });
  it('n’autorise live qu’avec tous les prérequis expressément attestés',()=>{
    expect(billingGate(validLive)).toMatchObject({enabled:true,mode:'live',priceSolo:'price_C3'});
    expect(billingGate({...validLive,BILLING_ENABLED:'false'}).enabled).toBe(false);
  });
});
