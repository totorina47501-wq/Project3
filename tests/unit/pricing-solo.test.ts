import { afterEach,expect,it,vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
vi.mock('server-only',()=>({}));
vi.mock('../../components/PricingCheckout',()=>({PricingCheckout:({plan}:{plan:string})=>createElement('button',null,'Paiement test '+plan)}));
import PricingPage from '../../app/tarifs/page';
afterEach(()=>vi.unstubAllEnvs());
it('propose Solo en bac à sable seulement si son tarif est configuré',()=>{
 for(const [key,value] of Object.entries({BILLING_ENABLED:'true',STRIPE_MODE:'test',STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_WEBHOOK_SECRET:'whsec_fixture',STRIPE_PRICE_SOLO:'price_SOLO',STRIPE_PRICE_PRO:'price_PRO',STRIPE_PRICE_STUDIO:'price_STUDIO'}))vi.stubEnv(key,value);
 expect(renderToStaticMarkup(PricingPage())).toContain('Paiement test solo');
 vi.stubEnv('STRIPE_PRICE_SOLO','');expect(renderToStaticMarkup(PricingPage())).not.toContain('Paiement test solo');
 vi.stubEnv('STRIPE_PRICE_SOLO','price_SOLO');vi.stubEnv('BILLING_ENABLED','false');expect(renderToStaticMarkup(PricingPage())).not.toContain('Paiement test');
});
