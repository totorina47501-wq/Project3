// Test réversible de droit API Cloudflare pour Preview URLs, Worker staging UNIQUEMENT.
import assert from 'node:assert/strict';
const acct='f9b14d5d93b1fe8ef3982d3ddb87131d';
const worker='mentioncheck-staging';
assert.equal(process.env.GITHUB_REF,'refs/heads/test/mentioncheck-staging-auth-20261108');
assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,acct);
const token=process.env.CLOUDFLARE_API_TOKEN;
assert.ok(token,'Missing staging Cloudflare token');
const origin='https://api.cloudflare.com/client/v4/accounts/'+acct;
const route='/workers/scripts/'+worker+'/subdomain';
const previewRoute='/workers/workers/'+worker+'/previews';
async function call(path,method='GET',body){
 const r=await fetch(origin+path,{method,headers:{Authorization:'Bearer '+token,
 ...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,
 signal:AbortSignal.timeout(16000)});
 let obj={};try{obj=await r.json();}catch{}
 if(!r.ok||obj.success!==true){
  throw new Error('CLOUDFLARE_STAGING_API_'+method+'_HTTP_'+r.status+
   '_CODE_'+(obj.errors?.[0]?.code??'unknown'));
 }
 return obj.result;
}
const before=await call(route);
assert.equal(typeof before.enabled,'boolean');
assert.equal(typeof before.previews_enabled,'boolean');
const previews=await call(previewRoute);
assert.ok(Array.isArray(previews),'Preview inventory unavailable');
assert.equal(previews.length,0,'Refuse to expose an existing Preview: first clean up');
console.log('STAGING_PREVIEW_PREFLIGHT_EMPTY_OK original='+before.previews_enabled);
let toggled=false,problem;
try{
 if(before.previews_enabled===false){
  await call(route,'POST',{enabled:before.enabled,previews_enabled:true});
  toggled=true;
 }
 const enabled=await call(route);
 assert.equal(enabled.enabled,before.enabled,'Worker public routing modified');
 assert.equal(enabled.previews_enabled,true,'Preview URLs not enabled');
 console.log('STAGING_PREVIEW_API_ENABLE_PASS worker='+worker);
}catch(e){problem=e;}finally{
 if(toggled){
  try{
   await call(route,'POST',{enabled:before.enabled,previews_enabled:before.previews_enabled});
   console.log('STAGING_PREVIEW_API_RESTORE_REQUESTED');
  }catch(e){problem=problem?new Error(problem.message+'; '+e.message):e;}
 }
 try{
  const after=await call(route);
  assert.equal(after.enabled,before.enabled);
  assert.equal(after.previews_enabled,before.previews_enabled);
  console.log('STAGING_PREVIEW_API_RESTORED_PASS original='+before.previews_enabled);
 }catch(e){problem=problem?new Error(problem.message+'; '+e.message):e;}
}
if(problem)throw problem;
console.log('STAGING_PREVIEW_TOGGLE_CREDENTIALS_PASS production_untouched=true');
