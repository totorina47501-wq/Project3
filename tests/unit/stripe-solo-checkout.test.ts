import { afterEach,beforeEach,expect,it,vi } from 'vitest';
const mocks=vi.hoisted(()=>({user:vi.fn(),admin:vi.fn(),stripe:vi.fn(),customer:vi.fn(),session:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('../../lib/security/auth',async original=>({...await original<typeof import('../../lib/security/auth')>(),requireUser:mocks.user}));
vi.mock('../../lib/supabase/admin',()=>({createAdminSupabase:mocks.admin}));
vi.mock('../../lib/billing/stripe',()=>({getStripe:mocks.stripe}));
import { POST } from '../../app/api/stripe/checkout/route';
const actor='10000000-0000-4000-8000-000000000001';
const request=()=>new Request('https://mentioncheck.test/api/stripe/checkout',{method:'POST',headers:{origin:'https://mentioncheck.test','content-type':'application/json'},body:JSON.stringify({plan:'solo'})});
beforeEach(()=>{
 vi.clearAllMocks();
 for(const [key,value] of Object.entries({BILLING_ENABLED:'true',STRIPE_MODE:'test',STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_WEBHOOK_SECRET:'whsec_fixture',STRIPE_PRICE_PRO:'price_PRO',STRIPE_PRICE_STUDIO:'price_STUDIO',STRIPE_PRICE_SOLO:''}))vi.stubEnv(key,value);
 mocks.user.mockResolvedValue({user:{id:actor,email:'fixture@example.test'}});
 mocks.admin.mockReturnValue({from:()=>({select:()=>({eq:()=>({single:async()=>({data:{stripe_customer_id:null},error:null})})}),update:()=>({eq:async()=>({error:null})})})});
 mocks.customer.mockResolvedValue({id:'cus_fixture'});mocks.session.mockResolvedValue({url:'https://checkout.stripe.test/fixture'});
 mocks.stripe.mockReturnValue({customers:{create:mocks.customer},checkout:{sessions:{create:mocks.session}}});
});
afterEach(()=>vi.unstubAllEnvs());
it('refuse Solo sans tarif avant tout accès SDK ou création de client',async()=>{
 expect((await POST(request())).status).toBe(503);expect(mocks.stripe).not.toHaveBeenCalled();expect(mocks.admin).not.toHaveBeenCalled();
});
it('refuse le checkout avant authentification lorsque la facturation est désactivée',async()=>{
 vi.stubEnv('BILLING_ENABLED','false');
 expect((await POST(request())).status).toBe(503);
 expect(mocks.user).not.toHaveBeenCalled();expect(mocks.admin).not.toHaveBeenCalled();expect(mocks.stripe).not.toHaveBeenCalled();
});
it('refuse une origine tierce avant authentification ou accès aux services',async()=>{
 const response=await POST(new Request('https://mentioncheck.test/api/stripe/checkout',{method:'POST',headers:{origin:'https://outside.test','content-type':'application/json'},body:JSON.stringify({plan:'solo'})}));
 expect(response.status).toBe(403);
 expect(mocks.user).not.toHaveBeenCalled();expect(mocks.admin).not.toHaveBeenCalled();expect(mocks.stripe).not.toHaveBeenCalled();
});
it('utilise le prix Solo configuré et l’identité serveur dans une session simulée',async()=>{
 vi.stubEnv('STRIPE_PRICE_SOLO','price_SOLO');expect((await POST(request())).status).toBe(200);
 expect(mocks.session).toHaveBeenCalledWith(expect.objectContaining({line_items:[{price:'price_SOLO',quantity:1}],metadata:{user_id:actor,selected_plan:'solo'}}));
});
it('masque les détails du fournisseur si la création de session échoue',async()=>{
 vi.stubEnv('STRIPE_PRICE_SOLO','price_SOLO');
 mocks.session.mockRejectedValue(new Error('private provider diagnostic'));
 const response=await POST(request());
 expect(response.status).toBe(503);
 const payload=await response.json();
 expect(payload).toEqual({error:'Le service est momentanément indisponible.'});
 expect(JSON.stringify(payload)).not.toContain('private provider diagnostic');
});
