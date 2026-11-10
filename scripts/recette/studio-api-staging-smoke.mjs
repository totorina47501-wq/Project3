// Recette E2E API Studio sur la seule base staging, sans paiement ni OpenAI.
// Deux comptes synthétiques, suppression par ID en finally ; aucun secret dans les logs.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
const BASE='https://mentioncheck-staging.toto-rina47501.workers.dev';
const DB='https://ukvgnkxgzyhswgpnvyzz.supabase.co';
const env=process.env;
if(env.GITHUB_REF!=='refs/heads/feat/mentioncheck-studio-api-entitlements-20261110' ||
 env.NEXT_PUBLIC_APP_URL!==BASE||env.NEXT_PUBLIC_SUPABASE_URL!==DB||
 env.BILLING_ENABLED!=='false'||env.OPENAI_PAUSED!=='true'||
 env.PROMO_SOLO_ENABLED!=='false'||!env.NEXT_PUBLIC_SUPABASE_ANON_KEY||
 !env.SUPABASE_SERVICE_KEY)throw Error('STAGING_STUDIO_API_BOUNDARY_FAILURE');
const admin=createClient(DB,env.SUPABASE_SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const created=[];
const createdWorkspaces=[];
function idToken(){return randomBytes(16).toString('hex');}
async function newTestOwner(label){
 const email='studio-api-'+String(env.GITHUB_RUN_ID||'local')+'-'+label+'-'+idToken()+'@example.invalid';
 const password='Staging_'+randomBytes(24).toString('hex')+'!9';
 const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,
  user_metadata:{purpose:'studio_api_staging_only'}});
 if(error||!data.user)throw Error('STAGING_STUDIO_AUTH_CREATE_FAILED');
 const id=data.user.id;created.push(id);
 const {error:profileError}=await admin.from('users').update({plan:'studio'}).eq('id',id);
 if(profileError)throw Error('STAGING_STUDIO_PROFILE_FAILED');
 const jar=new Map();
 const client=createServerClient(DB,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{
  cookies:{getAll:()=>Array.from(jar,([name,value])=>({name,value})),
   setAll:entries=>{for(const e of entries){if(e.options?.maxAge===0)jar.delete(e.name);else jar.set(e.name,e.value);}}},
 });
 const login=await client.auth.signInWithPassword({email,password});
 if(login.error||login.data.user?.id!==id)throw Error('STAGING_STUDIO_LOGIN_FAILED');
 const cookie=Array.from(jar,([name,value])=>name+'='+value).join('; ');
 if(!cookie.includes('sb-'))throw Error('STAGING_STUDIO_SESSION_COOKIE_MISSING');
 return {id,cookie};
}
async function sessionAction(owner,body){
 const r=await fetch(BASE+'/api/studio',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(20000),
  headers:{Cookie:owner.cookie,Origin:BASE,'Content-Type':'application/json'},body:JSON.stringify(body)});
 return {status:r.status,payload:await r.json()};
}
async function api(key,path,method='GET',body){
 const r=await fetch(BASE+path,{method,redirect:'manual',signal:AbortSignal.timeout(20000),
  headers:{Authorization:'Bearer '+key,Accept:'application/json',
   ...(body?{'Content-Type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 return {status:r.status,payload:await r.json()};
}
async function setSubscription(id,label){
 const {error}=await admin.from('subscriptions').insert({
  user_id:id,plan:'studio',status:'active',
  stripe_subscription_id:'sub_staging_api_'+String(env.GITHUB_RUN_ID||'local')+'_'+label+'_'+idToken(),
  current_period_end:new Date(Date.now()+24*3600*1000).toISOString(),
 });
 if(error)throw Error('STAGING_STUDIO_TEST_SUBSCRIPTION_FAILED');
}
const assertOk=(r,label)=>{assert.equal(r.status,200,label+' HTTP status');return r.payload;};
try{
 const guest=await fetch(BASE+'/api/v1/verifications',{signal:AbortSignal.timeout(20000)});
 assert.equal(guest.status,401);
 const invalid=await api('invalid','/api/v1/verifications');
 assert.equal(invalid.status,401);
 console.log('STAGING_API_NO_KEY_DENIED_PASS');

 const a=await newTestOwner('a'), b=await newTestOwner('b');
 const denied=await sessionAction(a,{action:'create_workspace',name:'sans-abonnement'});
 assert.equal(denied.status,403,'Studio doit refuser un profil sans souscription');
 await setSubscription(a.id,'a');await setSubscription(b.id,'b');
 const wa=assertOk(await sessionAction(a,{action:'create_workspace',name:'Equipe A'}),'workspace A').workspace.id;
 const wb=assertOk(await sessionAction(b,{action:'create_workspace',name:'Equipe B'}),'workspace B').workspace.id;
 createdWorkspaces.push({id:wa,owner:a.id},{id:wb,owner:b.id});
 assert.notEqual(wa,wb);
 const keyA=assertOk(await sessionAction(a,{action:'create_key',workspaceId:wa,name:'intégration A',
  scopes:['checks:read','checks:write']}),'key A').secret;
 const keyB=assertOk(await sessionAction(b,{action:'create_key',workspaceId:wb,name:'intégration B',
  scopes:['checks:read']}),'key B').secret;
 const check=await api(keyA,'/api/v1/check','POST',{caption:'Publicité : partenariat rémunéré.',platform:'instagram'});
 assert.equal(check.status,201,'Studio API POST autorisé');
 assert.equal(check.payload.verification.workspace_id,wa);
 const listA=assertOk(await api(keyA,'/api/v1/verifications'),'list A');
 const listB=assertOk(await api(keyB,'/api/v1/verifications'),'list B');
 assert.equal(listA.items.length,1);assert.equal(listB.items.length,0);
 assert.equal((await api(keyB,'/api/v1/check','POST',{caption:'Pub',platform:'instagram'})).status,403);
 console.log('STAGING_API_AUTH_SCOPES_CROSS_TENANT_PASS');

 const period=new Date().toISOString().slice(0,7)+'-01';
 const {error:usageError}=await admin.from('studio_api_usage_monthly').update({checks_used:2000})
   .eq('workspace_id',wa).eq('period_start',period);
 if(usageError)throw Error('STAGING_STUDIO_API_QUOTA_SEED_FAILED');
 assert.equal((await api(keyA,'/api/v1/check','POST',{caption:'Publicité',platform:'instagram'})).status,429);
 console.log('STAGING_API_MONTHLY_QUOTA_ENFORCED_PASS');

 const {error:expireError}=await admin.from('subscriptions').update({
  current_period_end:new Date(Date.now()-1000).toISOString(),
 }).eq('user_id',a.id);
 if(expireError)throw Error('STAGING_API_EXPIRE_FIXTURE_FAILED');
 assert.equal((await api(keyA,'/api/v1/verifications')).status,403);
 console.log('STAGING_API_STUDIO_SUBSCRIPTION_EXPIRY_DENIED_PASS');
 const {error:restoreError}=await admin.from('subscriptions').update({
  current_period_end:new Date(Date.now()+24*3600*1000).toISOString(),
 }).eq('user_id',a.id);
 if(restoreError)throw Error('STAGING_API_RESTORE_FIXTURE_FAILED');
 const {data:dbKey,error:keyError}=await admin.from('api_keys').select('id').eq('workspace_id',wa).maybeSingle();
 if(keyError||!dbKey?.id)throw Error('STAGING_API_KEY_REVOKE_FIXTURE_FAILED');
 assertOk(await sessionAction(a,{action:'revoke_key',workspaceId:wa,id:dbKey.id}),'revoke key');
 assert.equal((await api(keyA,'/api/v1/verifications')).status,403);
 console.log('STAGING_API_KEY_REVOKE_DENIED_PASS');
 }finally{
 let failed=false;
 // FK workspaces.owner_id est RESTRICT. Supprimer UNIQUEMENT les workspaces
 // que CETTE recette vient de créer, puis leurs propriétaires synthétiques.
 for(const ws of createdWorkspaces){
  const {error}=await admin.from('workspaces').delete().eq('id',ws.id).eq('owner_id',ws.owner);
  if(error)failed=true;
 }
 for(const id of created){
  const {error}=await admin.auth.admin.deleteUser(id);
  if(error)failed=true;
 }
 if(failed)throw Error('STAGING_API_SYNTHETIC_ACCOUNT_CLEANUP_FAILED');
 console.log('STAGING_API_TEST_ACCOUNTS_REMOVED');
}
