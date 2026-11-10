import { afterEach,beforeEach,expect,it,vi } from 'vitest';
const mocks=vi.hoisted(()=>({requireUser:vi.fn(),admin:vi.fn(),stripe:vi.fn(),create:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('../../lib/security/auth',async original=>({...await original<typeof import('../../lib/security/auth')>(),requireUser:mocks.requireUser}));
vi.mock('../../lib/supabase/admin',()=>({createAdminSupabase:mocks.admin}));
vi.mock('../../lib/billing/stripe',()=>({getStripe:mocks.stripe}));
import { POST } from '../../app/api/stripe/portal/route';

const call=(origin='https://local.test')=>new Request('https://local.test/api/stripe/portal',{method:'POST',headers:{origin}});
let customerId:string|null='cus_demo';
beforeEach(()=>{
 vi.clearAllMocks();customerId='cus_demo';
 for(const [key,value] of Object.entries({
  BILLING_ENABLED:'true',STRIPE_MODE:'test',STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_WEBHOOK_SECRET:'whsec_fixture',
  STRIPE_PRICE_SOLO:'price_SOLO',STRIPE_PRICE_PRO:'price_PRO',STRIPE_PRICE_STUDIO:'price_STUDIO'
 }))vi.stubEnv(key,value);
 mocks.requireUser.mockResolvedValue({user:{id:'10000000-0000-4000-8000-000000000001',email:'test@example.invalid'}});
 mocks.admin.mockReturnValue({from:()=>({select:()=>({eq:()=>({single:async()=>({data:{stripe_customer_id:customerId},error:null})})})})});
 mocks.create.mockResolvedValue({url:'https://billing.stripe.com/p/session/test_fixture'});
 mocks.stripe.mockReturnValue({billingPortal:{sessions:{create:mocks.create}}});
});
afterEach(()=>vi.unstubAllEnvs());

it('renvoie seulement le portail du client authentifié et l’URL de retour locale',async()=>{
 const r=await POST(call());expect(r.status).toBe(200);
 expect(await r.json()).toEqual({url:'https://billing.stripe.com/p/session/test_fixture'});
 expect(mocks.create).toHaveBeenCalledWith({customer:'cus_demo',return_url:'https://local.test/dashboard/settings'});
});
it('refuse la mauvaise origine avant tout appel Stripe',async()=>{
 expect((await POST(call('https://external.test'))).status).toBe(403);
 expect(mocks.requireUser).not.toHaveBeenCalled();expect(mocks.stripe).not.toHaveBeenCalled();
});
it('refuse sans compte Stripe associé',async()=>{
 customerId=null;expect((await POST(call())).status).toBe(404);
 expect(mocks.stripe).not.toHaveBeenCalled();
});
it('reste fermé quand la facturation est désactivée',async()=>{
 vi.stubEnv('BILLING_ENABLED','false');
 expect((await POST(call())).status).toBe(503);
 expect(mocks.stripe).not.toHaveBeenCalled();
});
