// Certification Cloudflare Preview sur le seul Worker staging, sans publication de production.
// Autorisation de suppression testée séparément avant ce workflow (HTTP 404 sur UUID inexistant).
// Garanties : garde-fous, preview unique, smoke HTTP, URLs rétablies, suppression par ID vérifiée.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const account='f9b14d5d93b1fe8ef3982d3ddb87131d';
const worker='mentioncheck-staging';
const stagingUrl='https://mentioncheck-staging.toto-rina47501.workers.dev';
const stagingDb='https://ukvgnkxgzyhswgpnvyzz.supabase.co';
const workerHostname='toto-rina47501.workers.dev';
assert.equal(process.env.GITHUB_REF,'refs/heads/test/mentioncheck-staging-auth-20261108');
assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,account);
assert.ok(process.env.CLOUDFLARE_API_TOKEN,'Jeton Cloudflare staging absent');
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL,stagingDb);
assert.equal(process.env.NEXT_PUBLIC_APP_URL,stagingUrl);
assert.equal(process.env.OPENAI_PAUSED,'true');
for(const name of ['OPENAI_TEXT_ENABLED','OPENAI_VISION_ENABLED','OPENAI_AUDIO_ENABLED',
 'OPENAI_EMBEDDINGS_ENABLED','BILLING_ENABLED','MEDIA_PROCESSING_ENABLED',
 'MEDIA_CLOUDFLARE_RUNNER_ENABLED','MEDIA_AI_ENABLED','MEDIA_RETENTION_ENABLED']){
 assert.equal(process.env[name],'false','Feature non coupée : '+name);
}
assert.equal(process.env.MEDIA_RUNNER_PAUSED,'true');
const prod=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
const st=JSON.parse(readFileSync('wrangler.staging.jsonc','utf8'));
assert.equal(prod.name,'mentioncheck');
assert.equal(st.name,worker);
assert.equal(st.main,'.open-next/worker.js');
assert.ok(prod.previews?.vars,'Configuration Preview correctrice absente');
const vars={...st.vars,...prod.previews.vars};
assert.equal(vars.NEXT_PUBLIC_SUPABASE_URL,stagingDb);
assert.equal(vars.NEXT_PUBLIC_APP_URL,stagingUrl);
assert.equal(vars.OPENAI_PAUSED,'true');
for(const key of ['BILLING_ENABLED','MEDIA_PROCESSING_ENABLED','MEDIA_AI_ENABLED',
 'MEDIA_RETENTION_ENABLED'])assert.equal(vars[key],'false');
assert.ok(!JSON.stringify(vars).includes('zcztvberuihphqklhjsr'),'Référence production interdite');
for(const key of ['containers','durable_objects','queues','services','d1_databases',
 'r2_buckets','kv_namespaces','hyperdrive','triggers']){
 assert.equal(st[key],undefined,'Binding staging non autorisé : '+key);
 assert.equal(prod.previews[key],undefined,'Binding Preview non autorisé : '+key);
}
const configPath='./wrangler.qa-preview.generated.jsonc';
writeFileSync(configPath,JSON.stringify({...st,previews:{vars}},null,2));
const previewName='qa-cert-'+(process.env.GITHUB_SHA??'').slice(0,8);
assert.match(previewName,/^qa-cert-[0-9a-f]{8}$/);
const configArgs=['--config',configPath];
const apiBase='https://api.cloudflare.com/client/v4/accounts/'+account;
const subdomainRoute='/workers/scripts/'+worker+'/subdomain';
const previewsRoute='/workers/workers/'+worker+'/previews';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function api(path,method='GET',body){
 const response=await fetch(apiBase+path,{
  method,
  headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,
    ...(body?{'Content-Type':'application/json'}:{})},
  body:body?JSON.stringify(body):undefined,
  signal:AbortSignal.timeout(18000)
 });
 const status=response.status;
 let parsed={};
 try{parsed=await response.json();}catch{}
 if(!response.ok||parsed.success===false){
  throw Error('STAGING_CF_API_'+method+'_HTTP_'+status+'_CODE_'+(parsed.errors?.[0]?.code??'unknown'));
 }
 return parsed.result;
}
async function allPreviews(){
 const list=await api(previewsRoute);
 assert.ok(Array.isArray(list),'Inventaire Preview inattendu');
 return list;
}
function cli(args){
 const result=spawnSync('npx',['--no-install','wrangler',...args],{
  encoding:'utf8',env:process.env,timeout:150000,maxBuffer:1500000});
 // Ne jamais imprimer la sortie brute : peut contenir un secret ou une URL.
 if(result.error||result.status!==0)
  throw Error('STAGING_WRANGLER_'+args[0].toUpperCase()+'_FAILED_'+(result.status??result.error?.code));
 return result.stdout??'';
}
function trustedUrl(text){
 try{
  const url=new URL(text);
  const expected=previewName+'-'+worker+'.'+workerHostname;
  if(url.protocol!=='https:'||url.hostname!==expected)return null;
  return new URL('/login',url).toString();
 }catch{return null;}
}
let before,enabled=false,mayExist=false,createdId=null,problem=null,clean=false,restored=false;
console.log('STAGING_PREVIEW_TARGET_BOUNDARY_PASS name='+previewName+' worker='+worker);
try{
 before=await api(subdomainRoute);
 assert.equal(typeof before.enabled,'boolean');
 assert.equal(typeof before.previews_enabled,'boolean');
 assert.equal(before.enabled,true,'Staging route inactive');
 assert.equal(before.previews_enabled,false,'Preview URLs déjà activées — refuser une fenêtre non contrôlée');
 const old=await allPreviews();
 assert.equal(old.length,0,'Refuser un deuxième Preview en présence de ressources existantes');
 console.log('STAGING_PREVIEW_EMPTY_INVENTORY_PASS');
 cli(['deploy','--dry-run',...configArgs]);
 console.log('STAGING_PREVIEW_PACKAGE_DRY_RUN_PASS');
 // Activer les URLs uniquement juste avant la création.
 await api(subdomainRoute,'POST',{enabled:before.enabled,previews_enabled:true});
 enabled=true;
 assert.equal((await api(subdomainRoute)).previews_enabled,true);
 console.log('STAGING_PREVIEW_URLS_TEMPORARILY_ENABLED');
 mayExist=true; // même un CLI non-zéro peut créer la Preview : nettoyage en finally !
 cli(['preview',...configArgs,'--worker-name',worker,
  '--name',previewName,'--ignore-base-config','--json']);
 console.log('STAGING_PREVIEW_WRANGLER_CREATE_ACCEPTED');
 let record=null;
 for(let attempt=0;attempt<9;attempt++){
  const list=await allPreviews();
  record=list.find(item=>item?.name===previewName)??null;
  if(record?.id)break;
  await delay(1700);
 }
 assert.ok(record?.id,'Preview créée mais introuvable dans API Cloudflare');
 createdId=record.id;
 console.log('STAGING_PREVIEW_CREATED_ID_VERIFIED');
 const listUrls=Array.isArray(record.urls)?record.urls:[];
 const known=[...listUrls,
  'https://'+previewName+'-'+worker+'.'+workerHostname];
 const candidates=[...new Set(known.map(trustedUrl).filter(Boolean))];
 assert.ok(candidates.length>0,'Aucune URL Preview du Worker staging confirmable');
 let matched=false,reason='UNKNOWN';
 for(let attempt=0;attempt<8&&!matched;attempt++){
  for(const url of candidates){
   try{
    const res=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(11500)});
    reason='HTTP_'+res.status;
    if(res.status!==200)continue;
    const body=await res.text();
    if(!/mentioncheck/i.test(body)){reason='UNEXPECTED_BODY';continue;}
    const guest=await fetch(new URL('/api/mia/conversations',url),{
      redirect:'manual',signal:AbortSignal.timeout(11000)});
    assert.ok([401,403].includes(guest.status),'Accès invité non refusé: '+guest.status);
    matched=true;
    console.log('STAGING_PREVIEW_LOGIN_HTTP_200_AND_GUEST_DENIED_PASS');
    break;
   }catch(err){reason=err?.name==='TimeoutError'?'TIMEOUT':String(err?.message??'NETWORK').slice(0,80);}
  }
  if(!matched&&attempt<7)await delay(1800);
 }
 if(!matched)throw Error('STAGING_PREVIEW_HTTP_SMOKE_FAILED_'+reason);
 console.log('STAGING_PREVIEW_OPERATIONAL_PASS');
}catch(error){problem=error;}finally{
 // Réduire l'exposition publique immédiatement, AVANT la suppression.
 if(enabled){
  try{
   await api(subdomainRoute,'POST',{enabled:before.enabled,
    previews_enabled:before.previews_enabled});
   console.log('STAGING_PREVIEW_URLS_RESTORE_REQUESTED');
  }catch(e){problem=problem?Error(problem.message+'; '+e.message):e;}
 }
 // La Preview peut exister même si Wrangler a échoué : retrouver UNIQUEMENT notre nom.
 if(mayExist){
  try{
   let records=await allPreviews();
   const target=records.filter(r=>r?.name===previewName);
   if(target.length>1)throw Error('STAGING_PREVIEW_DUPLICATE_NAME_REFUSE_CLEANUP');
   if(target.length===1){
    assert.match(target[0].id,/^[a-f0-9]{32}$/i,'ID Preview inattendu');
    await api(previewsRoute+'/'+target[0].id,'DELETE');
    console.log('STAGING_PREVIEW_DELETE_BY_ID_ACCEPTED');
   }
   for(let attempt=0;attempt<8;attempt++){
    records=await allPreviews();
    if(!records.some(r=>r.name===previewName))break;
    await delay(1400);
   }
   clean=!records.some(r=>r.name===previewName);
   assert.ok(clean,'Preview QA toujours présente après DELETE');
   assert.equal(records.length,0,'Autre Preview détectée après opération');
   console.log('STAGING_PREVIEW_NO_ORPHANS_PASS');
  }catch(e){problem=problem?Error(problem.message+'; '+e.message):e;}
 }
 try{
  const state=await api(subdomainRoute);
  assert.equal(state.enabled,before?.enabled);
  assert.equal(state.previews_enabled,before?.previews_enabled);
  restored=true;
  console.log('STAGING_PREVIEW_URLS_RESTORED_DISABLED_PASS');
 }catch(e){problem=problem?Error(problem.message+'; '+e.message):e;}
 rmSync(configPath,{force:true});
}
if(problem)throw problem;
assert.ok(createdId&&clean&&restored);
console.log('STAGING_CLOUDFLARE_PREVIEW_CERTIFICATION_PASS production_unchanged=true');
