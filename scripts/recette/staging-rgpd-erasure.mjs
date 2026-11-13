// RGPD: parcours reel UNIQUEMENT sur une fixture Auth/Storage creee par ce run staging.
// La suppression client en production reste desactivee; processeurs externes exclus.
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
const db='https://ukvgnkxgzyhswgpnvyzz.supabase.co';
const site='https://mentioncheck-staging.toto-rina47501.workers.dev';
assert.equal(process.env.GITHUB_REPOSITORY,'totorina47501-wq/Project3');
assert.equal(process.env.GITHUB_REF,'refs/heads/codex/codex-certification-six-chantiers');
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL,db);
assert.equal(process.env.NEXT_PUBLIC_APP_URL,site);
for(const [key,value] of Object.entries({
 OPENAI_PAUSED:'true',OPENAI_TEXT_ENABLED:'false',OPENAI_VISION_ENABLED:'false',
 OPENAI_AUDIO_ENABLED:'false',OPENAI_EMBEDDINGS_ENABLED:'false',
 BILLING_ENABLED:'false',PROMO_SOLO_ENABLED:'false',MEDIA_AI_ENABLED:'false',
 MEDIA_PROCESSING_ENABLED:'false',MEDIA_RETENTION_ENABLED:'false',
 MEDIA_CLOUDFLARE_RUNNER_ENABLED:'false'
})) assert.equal(process.env[key],value,'STAGING_GATE_'+key);
const adminKey=process.env.SUPABASE_SERVICE_KEY;
const anonKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
assert.ok(adminKey&&anonKey,'Staging keys required');
const opts={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const admin=createClient(db,adminKey,opts);
const run=randomUUID();
const email='qa-erasure-'+run+'@example.invalid';
const password='QA-'+randomBytes(24).toString('base64url')+'9aA!';
let id=null,objectPath=null,requestId=null,clean=false,error=null;
const ok=(res,kind)=>{
 if(res.error)throw Error('QA_'+kind+'_FAILED_'+(res.error.code??'API'));
 return res.data;
};
async function actorCheck(){
 assert.ok(id,'Missing QA user');
 const u=ok(await admin.auth.admin.getUserById(id),'GET_QA_ACTOR').user;
 assert.equal(u.id,id);
 assert.equal(u.email,email);
 assert.equal(u.app_metadata?.mentioncheck_erasure_qa,run,'Unknown user, delete prohibited');
}
async function tableCount(table,column){
 const {count,error}=await admin.from(table).select('id',{count:'exact',head:true}).eq(column,id);
 if(error)throw Error('QA_COUNT_'+table+'_FAILED');
 return count;
}
async function verifyZero(){
 for(const [table,key] of [
 ['users','id'],['verifications','user_id'],['media_assets','user_id'],
 ['privacy_erasure_requests','user_id'],['privacy_erasure_runs','user_id'],
 ['api_keys','created_by'],['workspaces','owner_id']]){
   assert.equal(await tableCount(table,key),0,'QA_ROWS_REMAIN_'+table);
 }
 if(objectPath){
   const files=ok(await admin.storage.from('verification-media').list(id),'LIST_QA_OBJECTS');
   assert.equal(files.some(file=>file.name===objectPath.split('/').at(-1)),false,'QA_OBJECT_REMAINS');
 }
 const gone=await admin.auth.admin.getUserById(id);
 assert.ok(gone.error,'QA_AUTH_USER_REMAINS');
 console.log('STAGING_RGPD_AUTH_STORAGE_SQL_ERASURE_PASS');
}
async function cleanup(){
 await actorCheck(); // Seuls les comptes portant ce marqueur aleatoire peuvent etre supprimes.
 if(objectPath)ok(await admin.storage.from('verification-media').remove([objectPath]),'DELETE_QA_STORAGE');
 if(requestId)ok(await admin.from('privacy_erasure_runs').delete()
   .eq('request_id',requestId).eq('user_id',id),'DELETE_QA_PREVIEW_JOURNAL');
 ok(await admin.from('users').update({ai_training_opt_in:false}).eq('id',id),'REVOKE_QA_CONSENT');
 ok(await admin.auth.admin.deleteUser(id),'DELETE_QA_AUTH');
 await verifyZero();
 clean=true;
}
try{
 // Staging peut contenir des utilisateurs OAuth preexistants : aucun reset global.
 // Seul l'acteur QA cree ici (email UUID + app_metadata du run) est effacable.
 // cleanup() exige actorCheck() avant chaque suppression ciblee sur id.
 const user=ok(await admin.auth.admin.createUser({email,password,email_confirm:true,
    app_metadata:{mentioncheck_erasure_qa:run}}),'CREATE_QA_USER').user;
 id=user.id;
 await actorCheck();
 if(!(await tableCount('users','id')))ok(await admin.from('users').insert({id,email}),'CREATE_QA_PROFILE');
 const account=ok(await admin.from('users').select('stripe_customer_id').eq('id',id).single(),'READ_QA_PROFILE');
 assert.equal(account.stripe_customer_id,null,'Real Stripe customer detected');
 ok(await admin.from('users').update({ai_training_opt_in:true}).eq('id',id),'QA_OPT_IN');
 ok(await admin.from('verifications').insert({
   user_id:id,platform:'instagram',content_text:'RGPD QA '+run
 }),'CREATE_QA_VERIFICATION');
 objectPath=id+'/qa-erasure-'+run+'.png';
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO0CLa8AAAAASUVORK5CYII=','base64');
 ok(await admin.storage.from('verification-media').upload(objectPath,png,{
    contentType:'image/png',upsert:false,
 }),'CREATE_QA_OBJECT');
 ok(await admin.from('media_assets').insert({
   user_id:id,kind:'image',storage_path:objectPath,mime_type:'image/png',declared_bytes:png.length
 }),'CREATE_QA_ASSET');
 const jar=new Map();
 const ssr=createServerClient(db,anonKey,{cookies:{
   getAll:()=>[...jar].map(([name,value])=>({name,value})),
   setAll:entries=>{for(const e of entries){
     if(e.options?.maxAge===0)jar.delete(e.name);
     else jar.set(e.name,e.value);
   }},
 }});
 const login=ok(await ssr.auth.signInWithPassword({email,password}),'QA_LOGIN');
 assert.equal(login.user?.id,id);
 const cookie=[...jar].map(([name,value])=>name+'='+value).join('; ');
 assert.ok(cookie.includes('sb-'),'QA_SESSION_COOKIE_ABSENT');
 const exportResp=await fetch(site+'/api/account/export',{headers:{Cookie:cookie},
    signal:AbortSignal.timeout(25000)});
 assert.equal(exportResp.status,200,'QA_EXPORT_HTTP');
 assert.match(exportResp.headers.get('cache-control')??'',/no-store/);
 assert.ok((await exportResp.text()).includes(run),'QA_EXPORT_INCOMPLETE');
 console.log('STAGING_RGPD_AUTH_EXPORT_PASS');
 async function post(body){
   return fetch(site+'/api/account/erasure',{method:'POST',
      headers:{Cookie:cookie,Origin:site,'Content-Type':'application/json'},
      body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
 }
 const requested=await post({action:'request',confirmation:'SUPPRIMER'});
 assert.equal(requested.status,202,'QA_ERASURE_REQUEST_HTTP');
 requestId=(await requested.json())?.request?.id;
 assert.match(requestId??'',/^[a-f0-9-]{36}$/);
 const preview=await post({action:'preview'});
 assert.equal(preview.status,200,'QA_ERASURE_PREVIEW_HTTP');
 const plan=(await preview.json()).plan;
 assert.equal(plan.dryRun,true);assert.equal(plan.deleted,false);
 assert.ok(plan.blockers.includes('destructive_executor_not_implemented'));
 console.log('STAGING_RGPD_REAL_REQUEST_PREVIEW_PASS');
 assert.equal(await tableCount('verifications','user_id'),1);
 const signedOut=await ssr.auth.signOut({scope:'global'});
 if(signedOut.error)throw Error('QA_SIGNOUT_FAILED');
 console.log('STAGING_RGPD_REFRESH_SESSION_REVOKED_PASS');
 await cleanup();
 console.log('STAGING_RGPD_SYNTHETIC_FULL_CLEANUP_PASS');
}catch(e){error=e;console.log('STAGING_RGPD_QA_ERROR='+e.message);}
finally{
 if(id&&!clean){
  try{await cleanup();console.log('STAGING_RGPD_QA_RECOVERY_PASS');}
  catch{error=Error('STAGING_RGPD_QA_RECOVERY_FAILED');}
 }
}
if(error)throw error;
