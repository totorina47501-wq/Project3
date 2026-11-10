// Recette Auth sur Worker staging seulement ; aucun appel OpenAI/Stripe payant.
// Un utilisateur de test est créé puis supprimé strictement par son ID.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

const BASE='https://mentioncheck-staging.toto-rina47501.workers.dev';
const DB='https://ukvgnkxgzyhswgpnvyzz.supabase.co';
const {NEXT_PUBLIC_APP_URL,NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY,SUPABASE_SERVICE_KEY,
  OPENAI_PAUSED,BILLING_ENABLED,PROMO_SOLO_ENABLED}=process.env;
if(NEXT_PUBLIC_APP_URL!==BASE||NEXT_PUBLIC_SUPABASE_URL!==DB||
  OPENAI_PAUSED!=='true'||BILLING_ENABLED!=='false'||PROMO_SOLO_ENABLED!=='false'||
  !NEXT_PUBLIC_SUPABASE_ANON_KEY||!SUPABASE_SERVICE_KEY) {
  throw Error('STAGING_AUTH_BOUNDARY_FAILED');
}
const admin=createClient(DB,SUPABASE_SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const email='staging-auth-'+String(process.env.GITHUB_RUN_ID||Date.now())+'@example.invalid';
const password='Staging_'+randomBytes(24).toString('hex')+'!9';
let userId=null;
const post=async (path,body)=>fetch(BASE+path,{
  method:'POST',redirect:'manual',signal:AbortSignal.timeout(20000),
  headers:{Origin:BASE,'Content-Type':'application/json'},
  body:JSON.stringify(body),
});
try {
  const login=await fetch(BASE+'/login',{signal:AbortSignal.timeout(20000)});
  assert.equal(login.status,200);
  const malformed=await post('/api/auth/login',{});
  assert.equal(malformed.status,400,'POST login exige Cloudflare IP et refuse corps invalide');
  const weak=await post('/api/auth/register',{email:'not-a-user@example.invalid',password:'WeakPass123'});
  assert.equal(weak.status,400,'POST register refuse un mot de passe de moins de 12 caractères');
  const checkout=await post('/api/stripe/checkout',{plan:'solo'});
  assert.equal(checkout.status,503,'Stripe doit rester désactivé');
  console.log('STAGING_AUTH_RATE_LIMIT_RUNTIME_AND_BILLING_CLOSED_PASS');

  const {data:created,error:createError}=await admin.auth.admin.createUser({
    email,password,email_confirm:true,user_metadata:{purpose:'auth_staging_smoke_only'},
  });
  if(createError||!created.user)throw Error('STAGING_AUTH_SYNTHETIC_USER_CREATE_FAILED');
  userId=created.user.id;
  const loginPost=await post('/api/auth/login',{email,password});
  assert.equal(loginPost.status,200,'La route login production doit accepter le compte technique');
  console.log('STAGING_AUTH_REAL_LOGIN_ROUTE_PASS');
  const jar=new Map();
  const ssr=createServerClient(DB,NEXT_PUBLIC_SUPABASE_ANON_KEY,{
    cookies:{
      getAll:()=>Array.from(jar,([name,value])=>({name,value})),
      setAll:entries=>{for(const entry of entries){
        if(entry.options?.maxAge===0)jar.delete(entry.name);
        else jar.set(entry.name,entry.value);
      }},
    },
  });
  const {data:session,error:sessionError}=await ssr.auth.signInWithPassword({email,password});
  if(sessionError||session.user?.id!==userId)throw Error('STAGING_AUTH_SSR_COOKIE_LOGIN_FAILED');
  const ssrCookie=Array.from(jar,([name,value])=>name+'='+value).join('; ');
  const loginCookie=(loginPost.headers.getSetCookie?.()??[])
    .map(line=>line.split(';',1)[0]).filter(Boolean).join('; ');
  const cookie=loginCookie.includes('sb-')?loginCookie:ssrCookie;
  if(!cookie.includes('sb-'))throw Error('STAGING_AUTH_SSR_COOKIE_ABSENT');
  const settings=await fetch(BASE+'/dashboard/settings',{
    redirect:'manual',signal:AbortSignal.timeout(25000),headers:{Cookie:cookie},
  });
  const html=await settings.text();
  // N'émettre que des marqueurs : jamais HTML, email, cookie ou information sensible.
  console.log('STAGING_SETTINGS_DIAGNOSTIC',JSON.stringify({
    status:settings.status,
    loginCookiePresent:loginCookie.includes('sb-'),
    ssrCookiePresent:ssrCookie.includes('sb-'),
    settingsHeading:html.includes('Mon abonnement actuel'),
    loginPage:html.includes('Content de te retrouver'),
    settingsNav:html.includes('Paramètres'),
    serverError:html.includes('Application error')||html.includes('Internal Server Error'),
    bodyLength:html.length,
  }));
  assert.equal(settings.status,200,'Paramètres doivent exiger Auth et fonctionner');
  assert.ok(html.includes('Mon abonnement actuel'),'Page paramètres absente');
  assert.ok(html.includes('Gratuit'),'Promotion ne doit pas être active sans GO');
  const guest=await fetch(BASE+'/api/mia/conversations',{signal:AbortSignal.timeout(20000)});
  assert.ok([401,403].includes(guest.status),'Une route privée est publique');
  console.log('STAGING_AUTH_PRIVATE_SETTINGS_AND_GUEST_DENIED_PASS');
} finally {
  if(userId){
    const {error}=await admin.auth.admin.deleteUser(userId);
    if(error)throw Error('STAGING_SYNTHETIC_AUTH_USER_CLEANUP_FAILED');
    console.log('STAGING_SYNTHETIC_AUTH_USER_DELETED');
  }
}
