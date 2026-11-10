// Recette réseau isolée : un compte synthétique distinct par plan pour tester
// 3 sessions sans contourner la protection anti-double-souscription.
// Aucun paiement / aucune carte / aucun appel IA. Nettoyage Auth en finally.
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
const createdIds=[];
const post=async(route,cookie,body)=>fetch(BASE+route,{
  method:'POST',redirect:'manual',signal:AbortSignal.timeout(20000),
  headers:{'Content-Type':'application/json',Origin:BASE,Cookie:cookie},
  body:JSON.stringify(body),
});
try {
  for(const plan of ['solo','pro','studio']) {
    const email='stripe-checkout-'+String(process.env.GITHUB_RUN_ID||Date.now())+'-'+plan+'@example.invalid';
    const password=randomBytes(32).toString('hex')+'xQ1!';
    const {data:created,error:createError}=await admin.auth.admin.createUser({
      email,password,email_confirm:true,
      user_metadata:{purpose:'stripe_checkout_staging_only'}
    });
    if(createError||!created.user)throw Error('STAGING_AUTH_CREATION_FAILED');
    const userId=created.user.id;
    createdIds.push(userId);
    const jar=new Map();
    const ssr=createServerClient(DB,NEXT_PUBLIC_SUPABASE_ANON_KEY,{
      cookies:{
        getAll:()=>Array.from(jar,([name,value])=>({name,value})),
        setAll:entries=>{for(const entry of entries){
          if(entry.options?.maxAge===0)jar.delete(entry.name);
          else jar.set(entry.name,entry.value);
        }}
      }
    });
    const {data:login,error:loginError}=await ssr.auth.signInWithPassword({email,password});
    if(loginError||login.user?.id!==userId)throw Error('STAGING_AUTH_LOGIN_FAILED');
    const cookie=Array.from(jar,([name,value])=>name+'='+value).join('; ');
    if(!cookie.includes('sb-')||!cookie)throw Error('STAGING_SSR_COOKIE_MISSING');
    const response=await post('/api/stripe/checkout',cookie,{plan});
    if(response.status!==200)
      throw Error('STAGING_CHECKOUT_'+plan.toUpperCase()+'_HTTP_'+response.status);
    const dest=new URL((await response.json()).url);
    assert.equal(dest.protocol,'https:');
    assert.equal(dest.hostname,'checkout.stripe.com');
    const {data:profile,error:profileError}=await admin
      .from('users').select('stripe_customer_id').eq('id',userId).single();
    if(profileError||!profile?.stripe_customer_id?.startsWith('cus_'))
      throw Error('STAGING_CUSTOMER_NOT_LINKED');
    console.log('CHECKOUT_AUTHENTICATED_'+plan.toUpperCase()+'_TEST_SESSION_CREATED');
    if(plan==='studio') {
      const portalResponse=await post('/api/stripe/portal',cookie,{});
      if(portalResponse.status!==200)
        throw Error('STAGING_PORTAL_HTTP_'+portalResponse.status);
      const portalUrl=new URL((await portalResponse.json()).url);
      assert.equal(portalUrl.protocol,'https:');
      assert.equal(portalUrl.hostname,'billing.stripe.com');
      console.log('STRIPE_PORTAL_AUTHENTICATED_TEST_SESSION_CREATED');
    }
  }
  console.log('STAGING_CHECKOUT_AND_PORTAL_AUTHENTICATED_PASS');
} finally {
  let cleanupFailed=false;
  for(const id of createdIds) {
    const {error}=await admin.auth.admin.deleteUser(id);
    if(error)cleanupFailed=true;
    else console.log('STAGING_SYNTHETIC_USER_DELETED');
  }
  if(cleanupFailed)throw Error('STAGING_SYNTHETIC_USER_CLEANUP_FAILED');
}
