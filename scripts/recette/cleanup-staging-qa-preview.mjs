// Nettoyage ciblé et idempotent d'une Preview QA créée par notre recette.
import assert from 'node:assert/strict';
const account='f9b14d5d93b1fe8ef3982d3ddb87131d';
const worker='mentioncheck-staging';
const id='c66150302c8f40f3824957d9f3a20f67';
const name='qa-cert-11cba5d3';
assert.equal(process.env.GITHUB_REF,'refs/heads/test/mentioncheck-staging-auth-20261108');
assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,account);
const token=process.env.CLOUDFLARE_API_TOKEN;
assert.ok(token,'Jeton de staging absent');
const base='https://api.cloudflare.com/client/v4/accounts/'+account;
async function call(path,method='GET'){
 const response=await fetch(base+path,{method,
  headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});
 let body={};
 try{body=await response.json();}catch{}
 if(!response.ok||body.success===false)
  throw Error('STAGING_PREVIEW_API_FAILED method='+method+' status='+response.status+
  ' error_code='+(body.errors?.[0]?.code??'unknown'));
 return body.result;
}
const listPath='/workers/workers/'+worker+'/previews';
const subdomain=await call('/workers/scripts/'+worker+'/subdomain');
console.log('STAGING_WORKER_SUBDOMAIN_PREVIEWS_ENABLED='+Boolean(subdomain?.previews_enabled));
const before=await call(listPath);
assert.ok(Array.isArray(before),'Liste des previews inattendue');
const found=before.find(x=>x?.id===id);
if(found){
 assert.equal(found.name,name,'Refus suppression d’une Preview non reconnue');
 console.log('STAGING_QA_PREVIEW_TARGET_VERIFIED name='+name);
 await call(listPath+'/'+id,'DELETE');
 console.log('STAGING_QA_PREVIEW_DELETE_API_PASS');
}else console.log('STAGING_QA_PREVIEW_ALREADY_ABSENT');
let after=[];
for(let i=0;i<4;i++){
 after=await call(listPath);
 if(!after.some(x=>x?.id===id))break;
 await new Promise(ok=>setTimeout(ok,1200));
}
assert.ok(!after.some(x=>x?.id===id),'La Preview jetable reste présente');
console.log('STAGING_QA_PREVIEW_CLEANUP_VERIFIED no_production_change=true');
