import { afterEach,beforeEach,expect,it,vi } from 'vitest';
const mocks=vi.hoisted(()=>({user:vi.fn(),admin:vi.fn(),stripe:vi.fn(),customer:vi.fn(),session:vi.fn(),retrievePrice:vi.fn(),subscriptionsList:vi.fn(),sessionsList:vi.fn(),forceLiveMode:false}));
vi.mock('server-only',()=>({}));
vi.mock('../../lib/security/auth',async original=>({...await original<typeof import('../../lib/security/auth')>(),requireUser:mocks.user}));
vi.mock('../../lib/supabase/admin',()=>({createAdminSupabase:mocks.admin}));
vi.mock('../../lib/billing/stripe',()=>({getStripe:mocks.stripe}));
vi.mock('../../lib/billing/config',async importOriginal=>{
 const actual=await importOriginal<typeof import('../../lib/billing/config')>();
 return {...actual,billingGate:(env:Parameters<typeof actual.billingGate>[0],purpose?:Parameters<typeof actual.billingGate>[1])=>
  mocks.forceLiveMode
   ? {enabled:true,mode:'live' as const,reason:'isolated test branch',priceSolo:env.STRIPE_PRICE_SOLO,pricePro:env.STRIPE_PRICE_PRO,priceStudio:env.STRIPE_PRICE_STUDIO}
   : actual.billingGate(env,purpose)};
});
import { POST } from '../../app/api/stripe/checkout/route';
const actor='10000000-0000-4000-8000-000000000001';
let existingSubscription: {stripe_subscription_id:string;status:string}|null=null;
let lookupFailure=false;
const request=(plan:'solo'|'pro'|'studio'='solo',origin='https://mentioncheck.test')=>new Request(origin+'/api/stripe/checkout',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({plan})});
beforeEach(()=>{
 vi.clearAllMocks();
 mocks.forceLiveMode=false;
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
 mocks.retrievePrice.mockResolvedValue({livemode:true,active:true,currency:'eur',unit_amount:900,recurring:{interval:'month'},tax_behavior:'inclusive'});
 mocks.subscriptionsList.mockResolvedValue({data:[]});mocks.sessionsList.mockResolvedValue({data:[]});
 mocks.stripe.mockReturnValue({prices:{retrieve:mocks.retrievePrice},customers:{create:mocks.customer},subscriptions:{list:mocks.subscriptionsList},checkout:{sessions:{create:mocks.session,list:mocks.sessionsList}}});
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
it.each([
 ['solo','price_SOLO'],
 ['pro','price_PRO'],
 ['studio','price_STUDIO'],
] as const)('utilise le prix Sandbox configuré et l’identité serveur pour %s',async(plan,price)=>{
 vi.stubEnv('STRIPE_PRICE_SOLO','price_SOLO');
 expect((await POST(request(plan))).status).toBe(200);
 expect(mocks.session).toHaveBeenCalledWith(expect.objectContaining({
  line_items:[{price,quantity:1}],
  metadata:{user_id:actor,selected_plan:plan},
  subscription_data:{metadata:{user_id:actor,plan}},
 }),expect.objectContaining({idempotencyKey:expect.stringContaining('mentioncheck_checkout_')}));
 expect(mocks.session.mock.calls[0]?.[0]).not.toHaveProperty('consent_collection');
});
it('exige le consentement aux CGV pour le Checkout Live après contrôle du tarif',async()=>{
 vi.stubEnv('STRIPE_PRICE_SOLO','price_SOLO');
 mocks.forceLiveMode=true;
 vi.stubEnv('NEXT_PUBLIC_APP_URL','https://mentioncheck.app');
 vi.stubEnv('STRIPE_LIVE_BUYER_SCOPE','verified_b2b_fr');
 // Live code now requires an operator-verified French professional buyer.
 mocks.user.mockResolvedValueOnce({user:{
   id:actor,email:'fixture@example.test',
   app_metadata:{mentioncheck_b2b:{
     verified:true,country:'FR',purchase_purpose:'core_professional_activity',
     reviewed_by:'operator',legal_name:'Société de Test',
     registration_id:'123456789',
     reviewed_at:new Date(Date.now()-60_000).toISOString(),
   }},
 }});
 const response=await POST(request('solo','https://mentioncheck.app'));
 expect(response.status,await response.clone().text()).toBe(200);
 expect(mocks.retrievePrice).toHaveBeenCalledWith('price_SOLO');
 expect(mocks.session).toHaveBeenCalledWith(expect.objectContaining({
  consent_collection:{terms_of_service:'required'}
 }),expect.any(Object));
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
