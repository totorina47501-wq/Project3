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
it('présente les trois prix indicatifs et les états sans paiement quand Stripe est désactivé',()=>{
 vi.stubEnv('BILLING_ENABLED','false');
 const markup=renderToStaticMarkup(PricingPage());
 for(const price of [9,19,49])expect(markup).toContain(`${price} €`);
 expect(markup).toContain('Démonstration gratuite disponible');
 expect(markup.match(/Abonnement bientôt disponible/g)).toHaveLength(2);
 expect(markup).not.toContain('Paiement test');
});
it('présente les limites réellement accordées, dont cinq sièges Studio propriétaire compris',()=>{
 vi.stubEnv('BILLING_ENABLED','false');
 const markup=renderToStaticMarkup(PricingPage());
 for(const plan of ['solo','pro','studio'] as const){
  const rights=planEntitlements(plan);
  for(const limit of [rights.checksMonthly,rights.rewritesMonthly,rights.miaMonthly])
   expect(markup).toContain(limit.toLocaleString('fr-FR'));
 }
 expect(markup).toContain('5 sièges, propriétaire compris');
 expect(markup).toContain('Comptes déclarés manuellement');
 expect(markup).toContain('API de contrôle sans IA');
 expect(markup).not.toMatch(/illimité|brand safety certifié/i);
});
