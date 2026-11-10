// Recette réseau strictement staging : 3 Checkout Sandbox authentifiés + portail.
// Aucun achat / aucune carte, aucun appel IA. L'utilisateur test est supprimé ensuite.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

const BASE='https://mentioncheck-staging.toto-rina47501.workers.dev';
const DB='https://ukvgnkxgzyhswgpnvyzz.supabase.co';
const {NEXT_PUBLIC_APP_URL,NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY,SUPABASE_SERVICE_KEY,
  STRIPE_MODE,BILLING_ENABLED,OPENAI_PAUSED}=process.env;
if(NEXT_PUBLIC_APP_URL!==BASE||NEXT_PUBLIC_SUPABASE_URL!==DB||
  !NEXT_PUBLIC_SUPABASE_ANON_KEY||!SUPABASE_SERVICE_KEY||
  STRIPE_MODE!=='test'||BILLING_ENABLED!=='false'||OPENAI_PAUSED!=='true') {
  throw Error('STAGING_CHECKOUT_BOUNDARY_FAILED');
}
const admin=createClient(DB,SUPABASE_SERVICE_KEY,{
  auth:{persistSession:false,autoRefreshToken:false}
});
const email='stripe-checkout-'+String(process.env.GITHUB_RUN_ID||Date.now())+'@example.invalid';
const password=randomBytes(32).toString('hex')+'xQ1!';
let userId=null;
const request=async (route,cookie)=>fetch(BASE+route,{
  method:'POST',redirect:'manual',signal:AbortSignal.timeout(20000),
  headers:{'Content-Type':'application/json',Origin:BASE,Cookie:cookie},
  body:route.endsWith('checkout')?JSON.stringify({plan:request.plan}):'{}'
});
try {
  const {data:created,error:createError}=await admin.auth.admin.createUser({
    email,password,email_confirm:true,
    user_metadata:{purpose:'stripe_checkout_staging_only'}
  });
  if(createError||!created.user)throw Error('STAGING_AUTH_CREATION_FAILED');
  userId=created.user.id;
  const cookieJar=new Map();
  const ssr=createServerClient(DB,NEXT_PUBLIC_SUPABASE_ANON_KEY,{
    cookies:{
      getAll:()=>Array.from(cookieJar,([name,value])=>({name,value})),
      setAll:(entries)=>{for(const entry of entries){
        if(entry.options?.maxAge===0)cookieJar.delete(entry.name);
        else cookieJar.set(entry.name,entry.value);
      }}
    }
  });
  const {data:login,error:loginError}=await ssr.auth.signInWithPassword({email,password});
  if(loginError||login.user?.id!==userId)throw Error('STAGING_AUTH_LOGIN_FAILED');
  const cookie=Array.from(cookieJar,([name,value])=>name+'='+value).join('; ');
  if(!cookie.includes('sb-')||!cookie)throw Error('STAGING_SSR_COOKIE_MISSING');
  for(const plan of ['solo','pro','studio']) {
    request.plan=plan;
    const response=await request('/api/stripe/checkout',cookie);
    if(response.status!==200)
      throw Error('STAGING_CHECKOUT_'+plan.toUpperCase()+'_HTTP_'+response.status);
    const result=await response.json();
    const dest=new URL(result.url);
    assert.equal(dest.protocol,'https:');
    assert.equal(dest.hostname,'checkout.stripe.com');
    console.log('CHECKOUT_AUTHENTICATED_'+plan.toUpperCase()+'_TEST_SESSION_CREATED');
  }
  const {data:profile,error:profileError}=await admin
    .from('users').select('stripe_customer_id').eq('id',userId).single();
  if(profileError||!profile?.stripe_customer_id?.startsWith('cus_'))
    throw Error('STAGING_CUSTOMER_NOT_LINKED');
  const portalResponse=await request('/api/stripe/portal',cookie);
  if(portalResponse.status!==200)
    throw Error('STAGING_PORTAL_HTTP_'+portalResponse.status);
  const portal=await portalResponse.json();
  const portalUrl=new URL(portal.url);
  assert.equal(portalUrl.protocol,'https:');
  assert.equal(portalUrl.hostname,'billing.stripe.com');
  console.log('STRIPE_PORTAL_AUTHENTICATED_TEST_SESSION_CREATED');
  console.log('STAGING_CHECKOUT_AND_PORTAL_AUTHENTICATED_PASS');
} finally {
  if(userId) {
    const {error}=await admin.auth.admin.deleteUser(userId);
    if(error)throw Error('STAGING_SYNTHETIC_USER_CLEANUP_FAILED');
    console.log('STAGING_SYNTHETIC_USER_DELETED');
  }
}
