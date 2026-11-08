// Preuve de routage d'une URL de version préexistante, aucun Preview créé.
import assert from 'node:assert/strict';
const account='f9b14d5d93b1fe8ef3982d3ddb87131d';
const worker='mentioncheck-staging';
const expected='https://mentioncheck-staging.toto-rina47501.workers.dev/login';
assert.equal(process.env.GITHUB_REF,'refs/heads/test/mentioncheck-staging-auth-20261108');
assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,account);
const token=process.env.CLOUDFLARE_API_TOKEN;
assert.ok(token);
const base='https://api.cloudflare.com/client/v4/accounts/'+account;
async function cf(path,method='GET',body){
 const res=await fetch(base+path,{method,headers:{Authorization:'Bearer '+token,
  ...(body?{'Content-Type':'application/json'}:{})},
  body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(18000)});
 let obj={};try{obj=await res.json();}catch{}
 if(!res.ok||obj.success!==true)throw Error('CLOUDFLARE_VERSION_PROBE_'+method+'_HTTP_'+res.status);
 return obj.result;
}
const path='/workers/scripts/'+worker+'/subdomain';
const initial=await cf(path);
assert.equal(initial.enabled,true);
assert.equal(initial.previews_enabled,false,'Ne pas altérer une configuration déjà ouverte');
const before=await cf('/workers/workers/'+worker+'/previews');
assert.ok(Array.isArray(before) && before.length===0,'Preview inconnue: refuse ouverture publique');
const deployments=await cf('/workers/scripts/'+worker+'/deployments');
const versions=deployments?.deployments?.[0]?.versions??[];
assert.equal(versions.length,1,'Une seule version à 100 % attendue');
const version=versions[0].version_id;
assert.match(version,/^[0-9a-f-]{36}$/i);
console.log('STAGING_VERSIONED_URL_PROBE_READY baseline=disabled');
let enabled=false,problem=null;
try{
 await cf(path,'POST',{enabled:true,previews_enabled:true});
 enabled=true;
 assert.equal((await cf(path)).previews_enabled,true);
 console.log('STAGING_VERSIONED_URLS_TEMPORARY_ENABLED');
 const suffix='-mentioncheck-staging.toto-rina47501.workers.dev';
 // Cloudflare docs: <VERSION_PREFIX>-<WORKER_NAME>.<SUBDOMAIN>.workers.dev.
 const prefixes=[version.slice(0,8),version.replaceAll('-',''),version];
 let passed=false;
 for(const prefix of prefixes){
  const url='https://'+prefix+suffix+'/login';
  try{
   const resp=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(8500)});
   if(resp.status!==200)continue;
   const body=await resp.text();
   if(/MentionCheck/i.test(body)){passed=true;console.log('STAGING_VERSIONED_LOGIN_HTTP_PASS prefix_len='+prefix.length);break;}
  }catch{}
 }
 if(!passed)throw Error('STAGING_VERSIONED_URL_SMOKE_NOT_CONFIRMED');
 const main=await fetch(expected,{signal:AbortSignal.timeout(14000)});
 assert.equal(main.status,200,'Worker staging non opérationnel');
 console.log('STAGING_VERSIONED_ROUTE_OPERATIONAL_PASS');
}catch(e){problem=e;}finally{
 if(enabled){
  try{await cf(path,'POST',{enabled:true,previews_enabled:false});
      console.log('STAGING_VERSIONED_URLS_DISABLE_REQUESTED');}
  catch(e){problem=problem?new Error(problem.message+'; '+e.message):e;}
 }
 try{
  const state=await cf(path);
  assert.equal(state.previews_enabled,false,'URL de preview encore publique !');
  assert.equal(state.enabled,true);
  const previews=await cf('/workers/workers/'+worker+'/previews');
  assert.equal(previews.length,0,'Prévisualisation imprévue');
  console.log('STAGING_VERSIONED_URLS_RESTORED_AND_NO_PREVIEWS_PASS');
 }catch(e){problem=problem?new Error(problem.message+'; '+e.message):e;}
}
if(problem)throw problem;
console.log('STAGING_VERSIONED_PREVIEW_URLS_CERTIFIED production_not_targeted=true');
