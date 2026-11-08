// Tests navigateur réels strictement staging, identités jetables et zéro IA.
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
const target='https://mentioncheck-staging.toto-rina47501.workers.dev';
const database='https://ukvgnkxgzyhswgpnvyzz.supabase.co';
assert.equal(process.env.PLAYWRIGHT_BASE_URL,target);
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL,database);
assert.equal(process.env.NEXT_PUBLIC_APP_URL,target);
assert.equal(process.env.OPENAI_PAUSED,'true');
for(const name of ['OPENAI_TEXT_ENABLED','OPENAI_VISION_ENABLED','OPENAI_AUDIO_ENABLED',
'OPENAI_EMBEDDINGS_ENABLED','MEDIA_AI_ENABLED','MEDIA_PROCESSING_ENABLED','BILLING_ENABLED',
'MEDIA_RETENTION_ENABLED'])assert.equal(process.env[name],'false','Coupe-circuit '+name);
const publicKey=process.env.MENTIONCHECK_STAGING_SUPABASE_ANON_KEY;
const secretKey=process.env.MENTIONCHECK_STAGING_SUPABASE_SERVICE_KEY;
assert.ok(publicKey&&secretKey,'Secrets staging manquants');
const admin=createClient(database,secretKey,{auth:{persistSession:false,autoRefreshToken:false}});
const run=randomUUID(),actorIds=[];
const requireData=(r,label)=>{if(r.error)throw Error(label+':'+(r.error.code??'FAILED'));return r.data;};
async function actor(suffix){
 const email='recette-'+run+'-'+suffix+'@example.test';
 const password='Test-'+randomBytes(21).toString('base64url')+'Aa9!';
 const user=requireData(await admin.auth.admin.createUser({
  email,password,email_confirm:true,app_metadata:{mentioncheck_staging_recette:run}
 }),'CREATE_USER').user;
 assert.ok(user?.id);
 actorIds.push(user.id);
 const profile=requireData(await admin.from('users').select('id').eq('id',user.id),'PROFILE');
 if(!profile.length)requireData(await admin.from('users').insert({id:user.id,email}),'CREATE_PROFILE');
 return {id:user.id,email,password};
}
async function quotas(id){
 const attempts=await Promise.all(Array.from({length:3},()=>admin.rpc('reserve_usage_quota',{p_user_id:id,p_action:'check'})));
 const periods=attempts.map(r=>requireData(r,'QUOTA_RESERVE'));
 assert.equal(new Set(periods).size,1);
 assert.ok(/^\d{4}-\d{2}-01$/.test(periods[0]));
 const used=requireData(await admin.from('usage_monthly').select('checks_used').eq('user_id',id).eq('period_start',periods[0]).single(),'QUOTA_READ');
 assert.equal(used.checks_used,3,'Réservation non atomique');
 const results=await Promise.all(periods.map(period=>admin.rpc('refund_usage_quota',{
  p_user_id:id,p_action:'check',p_period_start:period
 })));
 results.forEach(r=>requireData(r,'QUOTA_REFUND'));
 const final=requireData(await admin.from('usage_monthly').select('checks_used').eq('user_id',id).eq('period_start',periods[0]).single(),'QUOTA_FINAL');
 assert.equal(final.checks_used,0,'Quota non remboursé');
 console.log('STAGING_QUOTA_CONCURRENCY_PASS');
}
let failure=null;
try{
 const a=await actor('a'),b=await actor('b');
 const verification=requireData(await admin.from('verifications').insert({
   user_id:b.id,platform:'instagram',content_text:'Recette archive synthétique '+run,
   media_type:'none',status:'queued'
 }).select('id').single(),'ARCHIVE_FIXTURE').id;
 await quotas(a.id);
 const env={...process.env,E2E_STAGING_ONLY:'1',
  E2E_TEST_EMAIL:a.email,E2E_TEST_PASSWORD:a.password,
  E2E_TEST_EMAIL_B:b.email,E2E_TEST_PASSWORD_B:b.password,
  E2E_A_ID:a.id,E2E_B_ID:b.id,E2E_B_VERIFICATION_ID:verification,
  E2E_MEDIA_UPLOAD_ENABLED:'false'};
 const result=spawnSync(process.execPath,[
  './node_modules/@playwright/test/cli.js','test',
  'tests/e2e/authenticated-navigation.spec.ts','tests/e2e/private-navigation.spec.ts',
  'tests/e2e/free-mode-opt-in.spec.ts','tests/e2e/staging-live-recette.spec.ts','--reporter=line'
 ],{env,stdio:'inherit',timeout:270000});
 if(result.error)throw Error('PLAYWRIGHT_EXECUTION:'+result.error.code);
 assert.equal(result.status,0,'PLAYWRIGHT_STAGING_FAILED');
 console.log('STAGING_REAL_BROWSER_PASS');
}catch(error){failure=error;}finally{
 const errors=[];
 for(const id of [...actorIds].reverse()){
  const r=await admin.auth.admin.deleteUser(id);
  if(r.error)errors.push('AUTH_DELETE');
 }
 if(actorIds.length){
  const left=requireData(await admin.from('users').select('id').in('id',actorIds),'AFTER_CLEANUP');
  if(left.length)errors.push('PROFILE_LEFT');
 }
 if(errors.length)failure=Error((failure?.message??'')+' CLEANUP_INCOMPLETE:'+errors.join(','));
 else console.log('STAGING_BROWSER_CLEANUP_OK');
}
if(failure)throw failure;
