// Inspection exclusivement GET du Worker de production : aucun déploiement,
// aucune clé affichée et aucun appel OpenAI facturable. Échec fermé en cas de doute.
import { strict as assert } from 'node:assert';
const account='f9b14d5d93b1fe8ef3982d3ddb87131d';
const worker='mentioncheck';
assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID, account, 'Compte Cloudflare inattendu');
const token=process.env.CLOUDFLARE_API_TOKEN;
if(!token){console.log('PROD_AI_READONLY_NO_CLOUDFLARE_TOKEN');process.exit(0)}
const root='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/'+worker;
async function get(path){
  try {
    const response=await fetch(root+path,{
      method:'GET',headers:{Authorization:'Bearer '+token},
      signal:AbortSignal.timeout(16000),
    });
    if(!response.ok){console.log('PROD_AI_READONLY_DENIED_'+path.replace(/[^a-z]/gi,'_')+'_HTTP_'+response.status);return null}
    const data=await response.json();
    return data?.success===false?null:data?.result??null;
  }catch{console.log('PROD_AI_READONLY_NETWORK_ERROR');return null}
}
function safeList(x){
  if(Array.isArray(x))return x;
  if(Array.isArray(x?.bindings))return x.bindings;
  if(Array.isArray(x?.resources?.bindings))return x.resources.bindings;
  return [];
}
function namedFlag(bindings,name){
  // Afficher UNIQUEMENT les indicateurs attendus, jamais une variable arbitraire.
  const b=bindings.find(item=>item?.name===name && ['plain_text','text','var'].includes(item.type));
  const value=b?.text??b?.value;
  return value==='true'?'true':value==='false'?'false':'unknown';
}
const settings=await get('/settings');
if(settings){
  const items=safeList(settings);
  const flags=['OPENAI_PAUSED','OPENAI_TEXT_ENABLED','OPENAI_VISION_ENABLED',
    'OPENAI_AUDIO_ENABLED','OPENAI_EMBEDDINGS_ENABLED','MEDIA_AI_ENABLED','BILLING_ENABLED'];
  console.log('PROD_AI_RUNTIME_FLAGS '+flags.map(key=>key+'='+namedFlag(items,key)).join(' '));
}else console.log('PROD_AI_RUNTIME_FLAGS_UNVERIFIED');
const secrets=await get('/secrets');
if(secrets){
  const entries=Array.isArray(secrets)?secrets:Array.isArray(secrets?.secrets)?secrets.secrets:[];
  const names=new Set(entries.map(x=>x?.name).filter(x=>typeof x==='string'));
  console.log('PROD_OPENAI_SECRET_NAME_PRESENT '+names.has('OPENAI_API_KEY'));
}else console.log('PROD_OPENAI_SECRET_NAME_UNVERIFIED');
const deployments=await get('/deployments');
if(deployments){
  const list=Array.isArray(deployments)?deployments:Array.isArray(deployments?.deployments)?deployments.deployments:[];
  console.log('PROD_DEPLOYMENT_COUNT_READONLY '+list.length);
  for(const d of list.slice(0,2)){
    const versions=Array.isArray(d.versions)?d.versions:[];
    const ids=versions.map(x=>x.version_id??x.id).filter(x=>typeof x==='string'&&/^[0-9a-f-]{36}$/.test(x));
    console.log('PROD_DEPLOYMENT_VERSION '+ids.join(','));
  }
  console.log('PROD_GITHUB_SHA_NOT_PROVED_BY_CLOUDFLARE_DEPLOYMENT_ID');
}else console.log('PROD_DEPLOYMENT_UNVERIFIED');
// No request to an OpenAI endpoint, no secrets/values in logs, no POST/PATCH/PUT.
