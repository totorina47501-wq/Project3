// Validation hébergée des Cloudflare Worker Previews, STRICTEMENT sur mentioncheck-staging.
// Prévisualisation jetable, pas de déploiement de production, aucun appel IA/paiement.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const stagingWorker='mentioncheck-staging';
const stagingProject='ukvgnkxgzyhswgpnvyzz';
const account='f9b14d5d93b1fe8ef3982d3ddb87131d';
const allowedRef='refs/heads/test/mentioncheck-staging-auth-20261108';
assert.equal(process.env.GITHUB_REF,allowedRef,'Branche de recette exclusivement');
assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,account,'Compte Cloudflare inattendu');
assert.ok(process.env.CLOUDFLARE_API_TOKEN,'Jeton Cloudflare staging absent');
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL,'https://'+stagingProject+'.supabase.co');
assert.equal(process.env.NEXT_PUBLIC_APP_URL,'https://mentioncheck-staging.toto-rina47501.workers.dev');
assert.equal(process.env.OPENAI_PAUSED,'true');
for(const key of ['OPENAI_TEXT_ENABLED','OPENAI_VISION_ENABLED','OPENAI_AUDIO_ENABLED',
 'OPENAI_EMBEDDINGS_ENABLED','BILLING_ENABLED','MEDIA_PROCESSING_ENABLED',
 'MEDIA_CLOUDFLARE_RUNNER_ENABLED','MEDIA_AI_ENABLED','MEDIA_RETENTION_ENABLED']){
 assert.equal(process.env[key],'false','Feature interdite : '+key);
}
const prod=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
const st=JSON.parse(readFileSync('wrangler.staging.jsonc','utf8'));
assert.equal(prod.name,'mentioncheck');
assert.equal(st.name,stagingWorker);
assert.equal(st.main,'.open-next/worker.js');
assert.ok(prod.previews?.vars,'Correctif previews absent de la branche');
assert.equal(prod.previews.vars.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_URL);
assert.equal(prod.previews.vars.OPENAI_PAUSED,'true');
for(const key of ['containers','durable_objects','queues','d1_databases','r2_buckets',
 'kv_namespaces','hyperdrive','services','triggers']){
 assert.equal(st[key],undefined,'Binding staging interdit : '+key);
 assert.equal(prod.previews[key],undefined,'Binding Preview interdit : '+key);
}
const vars={...st.vars,...prod.previews.vars};
assert.equal(vars.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_URL);
assert.equal(vars.OPENAI_PAUSED,'true');
assert.equal(vars.BILLING_ENABLED,'false');
assert.equal(vars.MEDIA_PROCESSING_ENABLED,'false');
assert.ok(!JSON.stringify(vars).includes('zcztvberuihphqklhjsr'),'Supabase prod exclu');
const out='./wrangler.qa-preview.generated.jsonc';
const config={...st,previews:{vars}};
assert.equal(config.name,stagingWorker);
writeFileSync(out,JSON.stringify(config,null,2));
const sha=(process.env.GITHUB_SHA??'').slice(0,8);
assert.match(sha,/^[a-f0-9]{8}$/);
const previewName='qa-cert-'+sha;
const configFlag=['--config',out];
function wrangler(args){
 const result=spawnSync('npx',['--no-install','wrangler',...args],{
  env:process.env,encoding:'utf8',timeout:160000,maxBuffer:2_000_000});
 if(result.error||result.status!==0){
  const lines=(result.stderr+'\n'+result.stdout).split('\n')
  .filter(s=>/error|fail|denied|unauthorized|unsupported|preview|invalid|not found/i.test(s))
  .slice(-6).map(s=>s.replace(/postgres(?:ql)?:\/\/\S+/gi,'[DB_REDACTED]')
   .replace(/(Bearer |token|secret|password)[=: ]+\S+/gi,'$1[REDACTED]')
   .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g,'[KEY_REDACTED]')
   .slice(0,180));
  console.log('STAGING_PREVIEW_WRANGLER_DIAGNOSTIC '+lines.join(' | '));
  throw Error('WRANGLER_CLI_FAILED status='+(result.status??result.error?.code));
 }
 return result.stdout??'';
}
console.log('PREVIEW_STAGING_BOUNDARY_PASS worker='+stagingWorker+' ai=off billing=off');
let attempted=false,created=false,deleted=false,problem=null;
try{
 wrangler(['deploy','--dry-run',...configFlag]);
 console.log('STAGING_PREVIEW_PACKAGE_DRY_RUN_PASS');
 // Le Worker staging autorise actuellement les versions mais peut refuser les URLs Preview.
 // Vérifier AVANT d'en créer une : sinon une Preview inaccessible est laissée côté Cloudflare.
 const subdomainUrl='https://api.cloudflare.com/client/v4/accounts/'+account+
  '/workers/scripts/'+stagingWorker+'/subdomain';
 const subdomainResponse=await fetch(subdomainUrl,{method:'GET',
  headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN},
  signal:AbortSignal.timeout(15000)});
 assert.equal(subdomainResponse.status,200,'Impossible de contrôler les URLs Preview du staging');
 const subdomainData=await subdomainResponse.json();
 assert.equal(subdomainData.success,true,'Lecture Cloudflare refusée');
 if(subdomainData.result?.previews_enabled!==true){
  console.log('STAGING_PREVIEW_URLS_DISABLED — aucune Preview supplémentaire créée');
  throw Error('STAGING_PREVIEW_PREREQUISITE_BLOCKED: activer les URLs Preview du seul Worker staging');
 }
 attempted=true;
 const raw=wrangler(['preview',...configFlag,'--worker-name',stagingWorker,
 '--name',previewName,'--ignore-base-config','--json']);
 created=true;
 // Wrangler with assets may mix progress lines and JSON; parse the returned URL safely.
 let result=null;
 try{result=JSON.parse(raw);}catch{
  // Wrangler 4.156.2 peut imprimer la progression des assets AVANT l'objet JSON.
  const start=raw.search(/\{\s*"preview"\s*:/);
  if(start>=0){try{result=JSON.parse(raw.slice(start));}catch{}}
 }
 const candidates=[
 ...(Array.isArray(result?.preview?.urls)?result.preview.urls:[]),
 ...[...raw.matchAll(/https:\/\/[a-z0-9.-]+\.workers\.dev/gi)].map(m=>m[0])
 ];
 const chosen=candidates.find(x=>{
  try{
   const u=new URL(x);
   return u.protocol==='https:'&&u.hostname.endsWith('.workers.dev')&&
    u.hostname.includes(stagingWorker)&&u.hostname.startsWith(previewName+'-');
  }catch{return false;}
 });
 assert.ok(chosen,'Preview créée mais URL non identifiable dans la sortie Wrangler');
 const u=new URL(chosen);
 assert.notEqual(u.hostname,'mentioncheck.toto-rina47501.workers.dev');
 assert.notEqual(u.hostname,'mentioncheck-staging.toto-rina47501.workers.dev');
 console.log('STAGING_CLOUDFLARE_PREVIEW_CREATED worker='+stagingWorker);
 let response=null;
 for(let attempt=0;attempt<4;attempt++){
  try{
   response=await fetch(new URL('/login',chosen),{signal:AbortSignal.timeout(12000)});
   if(response.status===200)break;
  }catch{}
  await new Promise(resolve=>setTimeout(resolve,1500));
 }
 assert.equal(response?.status,200,'Login preview indisponible');
 const body=await response.text();
 assert.ok(/mentioncheck/i.test(body),'La preview ne sert pas MentionCheck');
 console.log('STAGING_CLOUDFLARE_PREVIEW_LOGIN_PASS');
}catch(err){problem=err;}finally{
 if(attempted){
  try{
   wrangler(['preview','delete',...configFlag,'--worker-name',stagingWorker,
     '--name',previewName,'--skip-confirmation']);
   deleted=true;
   console.log('STAGING_CLOUDFLARE_PREVIEW_CLEANUP_PASS');
  }catch(e){
   console.log('STAGING_CLOUDFLARE_PREVIEW_CLEANUP_FAILED');
   problem=problem?new Error(problem.message+'; '+e.message):e;
  }
 }
 rmSync(out,{force:true});
}
if(problem)throw problem;
assert.ok(created&&deleted,'Preview non créée ou non supprimée');
console.log('STAGING_CLOUDFLARE_PREVIEW_CERTIFICATION_PASS production_unchanged=true');
