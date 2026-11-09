// Diagnostic Cloudflare strictement en lecture seule. Aucune action de déploiement.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const account='f9b14d5d93b1fe8ef3982d3ddb87131d';
const buildId='a8f823e5-cc10-4b68-9ad6-348b4d779583';
assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,account,'Compte Cloudflare incorrect');
const token=process.env.CLOUDFLARE_API_TOKEN;
if(!token){console.log('CF_STAGING_DEPLOYMENTS_BLOCKED_NO_TOKEN');process.exit(0);}
const command=spawnSync('npx',['--no-install','wrangler','deployments','list',
 '--name','mentioncheck-staging','--config','wrangler.staging.jsonc','--json'],
 {encoding:'utf8',timeout:40000,env:process.env,maxBuffer:2000000});
if(command.error || command.status!==0){
 console.log('CF_STAGING_DEPLOYMENTS_READONLY_BLOCKED');
}else{
 const raw=command.stdout.trim();
 let data=null;
 try{data=JSON.parse(raw);}catch{
  const starts=[raw.indexOf('['),raw.indexOf('{')].filter(n=>n>=0);
  if(starts.length){try{data=JSON.parse(raw.slice(Math.min(...starts)));}catch{}}
 }
 if(!data)console.log('CF_STAGING_DEPLOYMENTS_READONLY_UNPARSEABLE');
 else{
  const entries=Array.isArray(data)?data:Array.isArray(data.result)?data.result:
   Array.isArray(data.deployments)?data.deployments:[];
  console.log('CF_STAGING_DEPLOYMENTS_READONLY_OK count='+entries.length);
  for(const item of entries.slice(0,7)){
   const versions=Array.isArray(item.versions)?item.versions:[];
   console.log('STAGING_VERSION_IDS '+versions.map(v=>v.version_id??v.id).filter(Boolean).join(','));
  }
 }
}
// Preuve de restaurabilité du Worker staging : aucune lecture de la valeur des secrets,
// uniquement présence des noms de bindings dans les versions historiques.
const candidateIds=[
 '07293543-3e88-4852-986e-ca229a23ad99',
 '606ef4f1-ddb3-4f15-8acb-c2fdc29c12c8',
 '3cdc6128-f55a-418f-ae16-94cc308e706b',
 'd98664b3-26ee-41fa-be7d-ca4b8672137e'
];
for(const id of candidateIds){
 const versionUrl='https://api.cloudflare.com/client/v4/accounts/'+account+
 '/workers/scripts/mentioncheck-staging/versions/'+id;
 try{
  const res=await fetch(versionUrl,{method:'GET',headers:{Authorization:'Bearer '+token},
   signal:AbortSignal.timeout(11000)});
  if(res.status!==200){
   console.log('STAGING_VERSION_READONLY_BLOCKED_HTTP_'+res.status);continue;
  }
  const payload=await res.json();
  const raw=payload.result?.resources?.bindings;
  const bindings=Array.isArray(raw)?raw:raw&&typeof raw==='object'?Object.values(raw):[];
  const names=bindings.filter(b=>b&&b.type==='secret_text').map(b=>b.name);
  const a=names.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const b=names.includes('SUPABASE_SERVICE_KEY');
  const date=payload.result?.metadata?.created_on??'unknown';
  console.log('STAGING_VERSION_SECRETS_PRESENT '+id+' public='+a+' server='+b+' date='+date);
 }catch{
  console.log('STAGING_VERSION_READONLY_NETWORK_BLOCKED');
 }
}

async function inspectHistoricalBuildLogs(){
const endpoint='https://api.cloudflare.com/client/v4/accounts/'+account+'/builds/builds/'+buildId+'/logs';
let response;
try{response=await fetch(endpoint,{method:'GET',headers:{Authorization:'Bearer '+token},
signal:AbortSignal.timeout(18000)});}catch{
 console.log('CF_BUILD_LOGS_NETWORK_BLOCKED');return;
}
if(response.status!==200){
 console.log('CF_BUILD_LOGS_READONLY_BLOCKED_HTTP_'+response.status);return;
}
let body;
try{body=await response.json();}catch{
 console.log('CF_BUILD_LOGS_BAD_JSON');return;
}
if(body.success===false){console.log('CF_BUILD_LOGS_PERMISSION_DENIED');return;}
const lines=Array.isArray(body.result?.lines)?body.result.lines:[];
const matches=lines.map(line=>Array.isArray(line)?line.slice(1).join(' '):'')
 .filter(line=>/error|fail|exception|exit code|timed out|not found|denied|previews|wrangler|build command|deploy command/i.test(line));
function sanitized(s){
 return s.replace(/(?:postgres(?:ql)?:\/\/)\S+/gi,'[DB_URL_REDACTED]')
 .replace(/\b(?:sb_(?:secret|publishable)_[\w-]+|sk-proj-[\w-]+|sk-[\w-]+)\b/g,'[API_KEY_REDACTED]')
 .replace(/(Authorization|Bearer|apikey|token|password|secret)[=: ]+\S+/gi,'$1=[REDACTED]')
 .slice(0,200);
}
console.log('CF_BUILD_LOGS_READONLY_OK matching_lines='+matches.length);
for(const line of matches.slice(-12))console.log('CF_BUILD_ERROR '+sanitized(line));



}
await inspectHistoricalBuildLogs();

// Inventaire STRICTEMENT lecture seule des Previews attachées au Worker staging.
// Un incident Wrangler JSON/assets peut laisser une preview temporaire : ne pas la deviner.
const previewEndpoint='https://api.cloudflare.com/client/v4/accounts/'+account+
 '/workers/workers/mentioncheck-staging/previews';
try{
 const reply=await fetch(previewEndpoint,{method:'GET',headers:{Authorization:'Bearer '+token},
  signal:AbortSignal.timeout(20000)});
 if(reply.status!==200)console.log('STAGING_PREVIEW_INVENTORY_BLOCKED_HTTP_'+reply.status);
 else{
  const response=await reply.json();
  const list=Array.isArray(response.result)?response.result:[];
  const qa=list.filter(x=>String(x?.name??'').startsWith('qa-cert-'));
  console.log('STAGING_PREVIEW_INVENTORY_OK total='+list.length+' qa='+qa.length);
  for(const item of qa.slice(0,12)){
   const host=Array.isArray(item.urls)?item.urls.map(u=>{
    try{return new URL(u).hostname}catch{return 'invalid'}
   }):[];
   console.log('STAGING_QA_PREVIEW_FOUND name='+item.name+' id='+item.id+' hosts='+host.join(','));
  }
 }
}catch{console.log('STAGING_PREVIEW_INVENTORY_NETWORK_BLOCKED');}
