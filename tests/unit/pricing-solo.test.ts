import { afterEach,expect,it,vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
vi.mock('server-only',()=>({}));
vi.mock('../../components/PricingCheckout',()=>({PricingCheckout:({plan}:{plan:string})=>createElement('button',null,'Paiement test '+plan)}));
import PricingPage from '../../app/tarifs/page';
import { planEntitlements } from '../../lib/billing/plans';
afterEach(()=>vi.unstubAllEnvs());
it('propose Solo en bac à sable seulement si son tarif est configuré',()=>{
 for(const [key,value] of Object.entries({BILLING_ENABLED:'true',STRIPE_MODE:'test',STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_WEBHOOK_SECRET:'whsec_fixture',STRIPE_PRICE_SOLO:'price_SOLO',STRIPE_PRICE_PRO:'price_PRO',STRIPE_PRICE_STUDIO:'price_STUDIO'}))vi.stubEnv(key,value);
 expect(renderToStaticMarkup(PricingPage())).toContain('Paiement test solo');
 vi.stubEnv('STRIPE_PRICE_SOLO','');expect(renderToStaticMarkup(PricingPage())).not.toContain('Paiement test solo');
 vi.stubEnv('STRIPE_PRICE_SOLO','price_SOLO');vi.stubEnv('BILLING_ENABLED','false');expect(renderToStaticMarkup(PricingPage())).not.toContain('Paiement test');
});
it('signale la pause IA sans promettre une analyse indisponible',()=>{
 vi.stubEnv('BILLING_ENABLED','false');
 vi.stubEnv('OPENAI_PAUSED','true');
 const markup=renderToStaticMarkup(PricingPage());
 expect(markup).toContain('fonctionnalités d’analyse et de réécriture IA sont temporairement indisponibles');
 expect(markup).not.toContain('Paiement test');
});
it('présente les trois prix indicatifs et les états sans paiement quand Stripe est désactivé',()=>{
 vi.stubEnv('BILLING_ENABLED','false');
 const markup=renderToStaticMarkup(PricingPage());
 for(const price of [9,19,49])expect(markup).toContain(`${price} €`);
 expect(markup).toContain('Démonstration gratuite disponible');
 expect(markup.match(/Abonnement bientôt disponible/g)).toHaveLength(3);
 expect(markup).toContain('Gratuit — 0 € / mois');
 expect(markup).toContain('sans carte bancaire ni abonnement Stripe');
 expect(markup).toContain('TVA non applicable, art. 293 B du CGI');
 expect(markup).toContain('forfaits payants sont mensuels, reconduits automatiquement');
 expect(markup).toContain('formulaire de rétractation');
 expect(markup).toContain('href="/legal/cgu"');
 expect(markup).not.toContain('Paiement test');
});
it('présente les limites réellement accordées, dont cinq sièges Studio propriétaire compris',()=>{
 vi.stubEnv('BILLING_ENABLED','false');
 const markup=renderToStaticMarkup(PricingPage());
 for(const plan of ['free','solo','pro','studio'] as const){
  const rights=planEntitlements(plan);
  for(const limit of [rights.checksMonthly,rights.rewritesMonthly,rights.miaMonthly])
   expect(markup).toContain(limit.toLocaleString('fr-FR'));
 }
 expect(markup).toContain('5 sièges, propriétaire compris');
 expect(markup).toContain('Comptes déclarés manuellement');
 expect(markup).toContain('API sans IA : 2 000 contrôles/mois par espace');
 expect(markup).toContain('href="/developpeurs"');
 expect(markup).not.toMatch(/illimité|brand safety certifié/i);
});

it('propose le Checkout Live en mode B2B ou public explicite, jamais sans portée définie',()=>{
 const keys={
  BILLING_ENABLED:'true',STRIPE_MODE:'live',STRIPE_SECRET_KEY:'sk_live_fixture',
  STRIPE_WEBHOOK_SECRET:'whsec_fixture',STRIPE_PRICE_SOLO:'price_SOLO',
  STRIPE_PRICE_PRO:'price_PRO',STRIPE_PRICE_STUDIO:'price_STUDIO',
  STRIPE_LIVE_APPROVED:'true',STRIPE_LIVE_LEGAL_REGISTRATION:'123456789',
  STRIPE_LIVE_TAX_REVIEW:'approved',STRIPE_LIVE_TERMS_REVIEW:'approved',
  STRIPE_LIVE_E2E_REVIEW:'passed',OPENAI_PAUSED:'false',
  OPENAI_TEXT_ENABLED:'true',OPENAI_VISION_ENABLED:'true',
  OPENAI_API_KEY:'sk-proj-fixture',NEXT_PUBLIC_APP_URL:'https://mentioncheck.app',
 };
 for(const [key,value] of Object.entries(keys))vi.stubEnv(key,value);
 expect(renderToStaticMarkup(PricingPage())).not.toContain('Paiement test solo');
 vi.stubEnv('STRIPE_LIVE_BUYER_SCOPE','verified_b2b_fr');
 const page=renderToStaticMarkup(PricingPage());
 expect(page).toContain('Paiement test solo');
 expect(page).toContain('professionnels français préalablement vérifiés');
 vi.stubEnv('STRIPE_LIVE_BUYER_SCOPE','general_public');
 const publicPage=renderToStaticMarkup(PricingPage());
 expect(publicPage).toContain('Paiement test solo');
 expect(publicPage).not.toContain('Souscription réservée aux professionnels français');
});
