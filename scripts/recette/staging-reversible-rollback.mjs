// Exercice réversible de rollback UNIQUEMENT sur le Worker staging.
// Crée une version sans changement de code en réappliquant la même clé serveur,
// puis revient explicitement à la version de référence qui contient les deux secrets.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const account='f9b14d5d93b1fe8ef3982d3ddb87131d';
const worker='mentioncheck-staging';
const base='d98664b3-26ee-41fa-be7d-ca4b8672137e';
const site='https://mentioncheck-staging.toto-rina47501.workers.dev';
assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,account);
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL,'https://ukvgnkxgzyhswgpnvyzz.supabase.co');
assert.equal(process.env.NEXT_PUBLIC_APP_URL,site);
assert.equal(process.env.OPENAI_PAUSED,'true');
for(const key of ['BILLING_ENABLED','MEDIA_RETENTION_ENABLED','MEDIA_AI_ENABLED']){
 assert.equal(process.env[key],'false');
}
const token=process.env.CLOUDFLARE_API_TOKEN;
const service=process.env.SUPABASE_SERVICE_KEY;
assert.ok(token&&service,'Jeton CF ou clé Supabase STAGING absent');
const prefix='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/'+worker;
async function api(path){
 const resp=await fetch(prefix+path,{method:'GET',headers:{Authorization:'Bearer '+token},
  signal:AbortSignal.timeout(18000)});
 if(!resp.ok)throw Error('CLOUDFLARE_READ_HTTP_'+resp.status);
 const data=await resp.json();
 if(!data.success)throw Error('CLOUDFLARE_READ_API_FAILED');
 return data.result;
}
async function active(){
 const data=await api('/deployments');
 const rows=data?.deployments;
 assert.ok(Array.isArray(rows)&&rows.length,'Aucun déploiement staging');
 const refs=rows[0]?.versions??[];
 assert.equal(refs.length,1,'Split de versions staging non autorisé');
 assert.equal(refs[0]?.percentage,100);
 return refs[0]?.version_id;
}
async function hasBothSecrets(version){
 const obj=await api('/versions/'+version);
 const raw=obj?.resources?.bindings;
 const bindings=Array.isArray(raw)?raw:raw&&typeof raw==='object'?Object.values(raw):[];
 const names=bindings.filter(x=>x?.type==='secret_text').map(x=>x.name);
 return names.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY')&&names.includes('SUPABASE_SERVICE_KEY');
}
function cli(args,input){
 const result=spawnSync('npx',['--no-install','wrangler',...args,
 '--config','wrangler.staging.jsonc'],{
  env:process.env,encoding:'utf8',timeout:90000,
  maxBuffer:2_000_000,input
 });
 // La sortie peut contenir des informations d'environnement, ne jamais l'afficher.
 if(result.error || result.status!==0)throw Error('STAGING_WRANGLER_FAILED_'+(result.status??result.error?.code));
}
async function smoke(phase){
 const login=await fetch(site+'/login',{signal:AbortSignal.timeout(20000)});
 if(login.status!==200)throw Error('STAGING_LOGIN_FAILED_'+phase+'_'+login.status);
 const guest=await fetch(site+'/api/mia/conversations',{signal:AbortSignal.timeout(20000)});
 if(![401,403].includes(guest.status))throw Error('STAGING_GUEST_UNSAFE_'+phase+'_'+guest.status);
 console.log('STAGING_HEALTH_OK_'+phase);
}
console.log('STAGING_ROLLBACK_ONLY_TARGET='+worker);
assert.equal(await active(),base,'Refus de muter staging : version active différente de référence');
assert.equal(await hasBothSecrets(base),true,'Version saine sans les deux secrets');
await smoke('BEFORE');
let mutated=false,restored=false,failure=null;
try{
 // Écriture limitée à un secret EXISTANT, avec la MÊME valeur; aucun changement de code.
 mutated=true;
 cli(['secret','put','SUPABASE_SERVICE_KEY'],service+'\n');
 const newVersion=await active();
 assert.notEqual(newVersion,base,'Nouvelle version non créée');
 assert.equal(await hasBothSecrets(newVersion),true,'Version de test sans les deux clés');
 await smoke('NEW_VERSION');
 console.log('STAGING_ROLLBACK_SECOND_SAFE_VERSION_CREATED');
 cli(['rollback',base,'--name',worker,'--message','QA staging rollback sans changement de code']);
 assert.equal(await active(),base,'Rollback sans version de référence active');
 assert.equal(await hasBothSecrets(base),true);
 await smoke('AFTER_ROLLBACK');
 restored=true;
 console.log('STAGING_REAL_ROLLBACK_OPERATION_PASS');
}catch(e){failure=e;}
finally{
 if(mutated&&!restored){
  // Restaurer la version ancienne validée sur échec partiel. Ne jamais tenter un fallback prod.
  try{
   cli(['rollback',base,'--name',worker,'--message','QA staged automatic recovery']);
   assert.equal(await active(),base);
   await smoke('RECOVERY');
   console.log('STAGING_AUTOMATIC_RECOVERY_OK');
  }catch(e){
   console.log('STAGING_AUTOMATIC_RECOVERY_FAILED');
   failure=new Error((failure?.message??'')+' '+e.message);
  }
 }
}
if(failure)throw failure;
