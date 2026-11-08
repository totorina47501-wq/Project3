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
const endpoint='https://api.cloudflare.com/client/v4/accounts/'+account+'/builds/builds/'+buildId+'/logs';
let response;
try{response=await fetch(endpoint,{method:'GET',headers:{Authorization:'Bearer '+token},
signal:AbortSignal.timeout(18000)});}catch{
 console.log('CF_BUILD_LOGS_NETWORK_BLOCKED');process.exit(0);
}
if(response.status!==200){
 console.log('CF_BUILD_LOGS_READONLY_BLOCKED_HTTP_'+response.status);process.exit(0);
}
let body;
try{body=await response.json();}catch{
 console.log('CF_BUILD_LOGS_BAD_JSON');process.exit(0);
}
if(body.success===false){console.log('CF_BUILD_LOGS_PERMISSION_DENIED');process.exit(0);}
const lines=Array.isArray(body.result?.lines)?body.result.lines:[];
const matches=lines.map(line=>Array.isArray(line)?line.slice(1).join(' '):'')
 .filter(line=>/error|fail|exception|exit code|timed out|not found|denied/i.test(line));
function sanitized(s){
 return s.replace(/(?:postgres(?:ql)?:\/\/)\S+/gi,'[DB_URL_REDACTED]')
 .replace(/\b(?:sb_(?:secret|publishable)_[\w-]+|sk-proj-[\w-]+|sk-[\w-]+)\b/g,'[API_KEY_REDACTED]')
 .replace(/(Authorization|Bearer|apikey|token|password|secret)[=: ]+\S+/gi,'$1=[REDACTED]')
 .slice(0,200);
}
console.log('CF_BUILD_LOGS_READONLY_OK matching_lines='+matches.length);
for(const line of matches.slice(-12))console.log('CF_BUILD_ERROR '+sanitized(line));
