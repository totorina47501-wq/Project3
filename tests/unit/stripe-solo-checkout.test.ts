import { afterEach,beforeEach,expect,it,vi } from 'vitest';
const mocks=vi.hoisted(()=>({user:vi.fn(),admin:vi.fn(),stripe:vi.fn(),customer:vi.fn(),session:vi.fn(),subscriptionsList:vi.fn(),sessionsList:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('../../lib/security/auth',async original=>({...await original<typeof import('../../lib/security/auth')>(),requireUser:mocks.user}));
vi.mock('../../lib/supabase/admin',()=>({createAdminSupabase:mocks.admin}));
vi.mock('../../lib/billing/stripe',()=>({getStripe:mocks.stripe}));
import { POST } from '../../app/api/stripe/checkout/route';
const actor='10000000-0000-4000-8000-000000000001';
let existingSubscription: {stripe_subscription_id:string;status:string}|null=null;
let lookupFailure=false;
const request=()=>new Request('https://mentioncheck.test/api/stripe/checkout',{method:'POST',headers:{origin:'https://mentioncheck.test','content-type':'application/json'},body:JSON.stringify({plan:'solo'})});
beforeEach(()=>{
 vi.clearAllMocks();
 existingSubscription=null;lookupFailure=false;
 for(const [key,value] of Object.entries({BILLING_ENABLED:'true',STRIPE_MODE:'test',STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_WEBHOOK_SECRET:'whsec_fixture',STRIPE_PRICE_PRO:'price_PRO',STRIPE_PRICE_STUDIO:'price_STUDIO',STRIPE_PRICE_SOLO:''}))vi.stubEnv(key,value);
 mocks.user.mockResolvedValue({user:{id:actor,email:'fixture@example.test'}});
 mocks.admin.mockReturnValue({from:(table:string)=>{
  if(table==='subscriptions')return {select:()=>({eq:()=>({maybeSingle:async()=>({
    data:existingSubscription,error:lookupFailure?{message:'private db error'}:null
  })})})};
  if(table==='users')return {select:()=>({eq:()=>({single:async()=>({data:{stripe_customer_id:null},error:null})})}),update:()=>({eq:async()=>({error:null})})};
  throw new Error('Unexpected table');
 }});
 mocks.customer.mockResolvedValue({id:'cus_fixture'});mocks.session.mockResolvedValue({url:'https://checkout.stripe.test/fixture'});
 mocks.subscriptionsList.mockResolvedValue({data:[]});mocks.sessionsList.mockResolvedValue({data:[]});
 mocks.stripe.mockReturnValue({customers:{create:mocks.customer},subscriptions:{list:mocks.subscriptionsList},checkout:{sessions:{create:mocks.session,list:mocks.sessionsList}}});
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
 vi.stubEnv('STRIPE_PRICE_SOLO','price_SOLO');
 const response=await POST(new Request('https://mentioncheck.test/api/stripe/checkout',{method:'POST',headers:{origin:'https://outside.test','content-type':'application/json'},body:JSON.stringify({plan:'solo'})}));
 expect(response.status).toBe(403);
 expect(mocks.user).not.toHaveBeenCalled();expect(mocks.admin).not.toHaveBeenCalled();expect(mocks.stripe).not.toHaveBeenCalled();
});
it('refuse le domaine workers.dev pour un checkout live même avec origine same-origin',async()=>{
 vi.stubEnv('STRIPE_PRICE_SOLO','price_SOLO');
 for(const [key,value] of Object.entries({
  STRIPE_MODE:'live',STRIPE_SECRET_KEY:'sk_live_fixture',
  STRIPE_LIVE_APPROVED:'true',STRIPE_LIVE_LEGAL_REGISTRATION:'123456789',
  STRIPE_LIVE_TAX_REVIEW:'approved',STRIPE_LIVE_TERMS_REVIEW:'approved',STRIPE_LIVE_E2E_REVIEW:'passed',
  OPENAI_PAUSED:'false',OPENAI_TEXT_ENABLED:'true',OPENAI_VISION_ENABLED:'true',
  OPENAI_API_KEY:'sk-proj-fixture',NEXT_PUBLIC_APP_URL:'https://mentioncheck.app'
 }))vi.stubEnv(key,value);
 const legacyOrigin='https://mentioncheck.toto-rina47501.workers.dev';
 const response=await POST(new Request(legacyOrigin+'/api/stripe/checkout',{
   method:'POST',headers:{origin:legacyOrigin,'content-type':'application/json'},
   body:JSON.stringify({plan:'solo'})
 }));
 expect(response.status).toBe(403);
 expect(mocks.user).not.toHaveBeenCalled();
 expect(mocks.admin).not.toHaveBeenCalled();
 expect(mocks.stripe).not.toHaveBeenCalled();
});
it('utilise le prix Solo configuré et l’identité serveur dans une session simulée',async()=>{
 vi.stubEnv('STRIPE_PRICE_SOLO','price_SOLO');expect((await POST(request())).status).toBe(200);
 expect(mocks.session).toHaveBeenCalledWith(expect.objectContaining({line_items:[{price:'price_SOLO',quantity:1}],metadata:{user_id:actor,selected_plan:'solo'}}),expect.objectContaining({idempotencyKey:expect.stringContaining('mentioncheck_checkout_')}));
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

it('empêche le doublon de souscription et renvoie vers le portail sans appel Stripe',async()=>{
 vi.stubEnv('STRIPE_PRICE_SOLO','price_SOLO');
 existingSubscription={stripe_subscription_id:'sub_existing',status:'active'};
 const response=await POST(request());
 expect(response.status).toBe(409);
 expect(mocks.customer).not.toHaveBeenCalled();
 expect(mocks.session).not.toHaveBeenCalled();
 expect(mocks.stripe).not.toHaveBeenCalled();
});
it('refuse aussi une souscription impayée pour empêcher un abonnement parallèle',async()=>{
 vi.stubEnv('STRIPE_PRICE_SOLO','price_SOLO');
 existingSubscription={stripe_subscription_id:'sub_unpaid',status:'past_due'};
 expect((await POST(request())).status).toBe(409);
 expect(mocks.stripe).not.toHaveBeenCalled();
});
it('refuse en cas de lecture de souscription indisponible',async()=>{
 vi.stubEnv('STRIPE_PRICE_SOLO','price_SOLO');
 lookupFailure=true;
 const response=await POST(request());
 expect(response.status).toBe(503);
 expect(JSON.stringify(await response.json())).not.toContain('private db error');
 expect(mocks.stripe).not.toHaveBeenCalled();
});
it('autorise une nouvelle souscription quand la précédente est annulée',async()=>{
 vi.stubEnv('STRIPE_PRICE_SOLO','price_SOLO');
 existingSubscription={stripe_subscription_id:'sub_canceled',status:'canceled'};
 expect((await POST(request())).status).toBe(200);
 expect(mocks.session).toHaveBeenCalledTimes(1);
});


it('refuse toute session de souscription Checkout ouverte avant une seconde création',async()=>{
 vi.stubEnv('STRIPE_PRICE_SOLO','price_SOLO');
 mocks.sessionsList.mockResolvedValue({data:[{mode:'subscription',status:'open'}]});
 const response=await POST(request());
 expect(response.status).toBe(409);
 expect(mocks.session).not.toHaveBeenCalled();
});
it('refuse un abonnement fournisseur incomplet même si le webhook est en retard',async()=>{
 vi.stubEnv('STRIPE_PRICE_SOLO','price_SOLO');
 mocks.subscriptionsList.mockResolvedValue({data:[{status:'incomplete'}]});
 const response=await POST(request());
 expect(response.status).toBe(409);
 expect(mocks.sessionsList).not.toHaveBeenCalled();
 expect(mocks.session).not.toHaveBeenCalled();
});
it('échoue fermé si la recherche des sessions fournisseur est indisponible',async()=>{
 vi.stubEnv('STRIPE_PRICE_SOLO','price_SOLO');
 mocks.sessionsList.mockRejectedValue(new Error('private Stripe failure'));
 const response=await POST(request());
 expect(response.status).toBe(503);
 expect(JSON.stringify(await response.json())).not.toContain('private Stripe failure');
 expect(mocks.session).not.toHaveBeenCalled();
});
it('réutilise une clé idempotente unique pour deux plans concurrentiels du même compte',async()=>{
 vi.stubEnv('STRIPE_PRICE_SOLO','price_SOLO');
 const now=vi.spyOn(Date,'now').mockReturnValue(1_700_000_000_000);
 try {
   expect((await POST(request())).status).toBe(200);
   const pro=new Request('https://mentioncheck.test/api/stripe/checkout',{method:'POST',
     headers:{origin:'https://mentioncheck.test','content-type':'application/json'},
     body:JSON.stringify({plan:'pro'})});
   expect((await POST(pro)).status).toBe(200);
   expect(mocks.session).toHaveBeenCalledTimes(2);
   const first=mocks.session.mock.calls[0]![1].idempotencyKey;
   const second=mocks.session.mock.calls[1]![1].idempotencyKey;
   expect(first).toBe(second);
 } finally { now.mockRestore(); }
});
