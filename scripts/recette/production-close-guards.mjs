// Emergency closure only: no application upload, database change or paid API call.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
export const closedFlags = Object.freeze(Object.fromEntries([
  'OPENAI_PAUSED','OPENAI_TEXT_ENABLED','OPENAI_VISION_ENABLED','OPENAI_AUDIO_ENABLED',
  'OPENAI_EMBEDDINGS_ENABLED','MEDIA_AI_ENABLED','BILLING_ENABLED','STRIPE_WEBHOOK_ENABLED',
  'STRIPE_LIVE_APPROVED','SOCIAL_OAUTH_ENABLED','SOCIAL_OAUTH_YOUTUBE_ENABLED',
  'SOCIAL_OAUTH_INSTAGRAM_ENABLED','SOCIAL_OAUTH_TIKTOK_ENABLED','SOCIAL_OAUTH_LINKEDIN_ENABLED',
  'PROMO_SOLO_ENABLED',
].map(name => [name, name === 'OPENAI_PAUSED' ? 'true' : 'false'])));
export function closureBindings(bindings) {
  assert.ok(Array.isArray(bindings) && bindings.length > 0, 'Missing bindings');
  assert.equal(new Set(bindings.map(b=>b.name)).size, bindings.length, 'Duplicate bindings');
  for (const b of bindings) {
    assert.ok(typeof b.name === 'string' && b.name.length > 0, 'Invalid binding');
    if (Object.hasOwn(closedFlags,b.name)) assert.equal(b.type,'plain_text','Flag must be plain text');
  }
  return [
    ...bindings.filter(b=>!Object.hasOwn(closedFlags,b.name)).map(b=>b.type.startsWith('secret_') ? {name:b.name,type:'inherit'} : {...b}),
    ...Object.entries(closedFlags).map(([name,text])=>({name,type:'plain_text',text})),
  ];
}
async function main() {
  assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,'f9b14d5d93b1fe8ef3982d3ddb87131d');
  assert.equal(process.env.CLOSE_PRODUCTION_GUARDS,'close-only');
  const token=process.env.CLOUDFLARE_API_TOKEN;
  assert.ok(token,'Production write token missing');
  const root='https://api.cloudflare.com/client/v4/accounts/f9b14d5d93b1fe8ef3982d3ddb87131d/workers/scripts/mentioncheck';
  async function api(path,method='GET',body) {
    const r=await fetch(root+path,{method,body,headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)});
    const data=await r.json();
    const codes=(data.errors??[]).map(e=>Number(e.code)).filter(Number.isFinite).join(',');
    assert.ok(r.ok,'Cloudflare '+method+' '+path+' HTTP '+r.status+' codes='+codes+' '+(method==='PATCH' ? (data.errors??[]).map(e=>String(e.message??'').replaceAll(token,'[redacted]')).join('; ') : ''));
    assert.equal(data.success,true,'Cloudflare request failed');
    return data.result;
  }
  const expected='851096ef-dd10-4e94-986c-498132fd93ea';
  async function checkVersion() {
    const deployments=await api('/deployments');
    const active=deployments.deployments?.[0]?.versions;
    assert.equal(active?.length,1,'Split deployment: stop');
    assert.equal(active[0].version_id,expected,'Production version changed: stop');
    assert.equal(active[0].percentage,100,'Deployment is not at 100 percent');
    const versions=await api('/versions');
    assert.equal(versions.items?.[0]?.id,expected,'Undeployed version exists: stop');
  }
  await checkVersion();
  const before=await api('/settings');
  const bindings=closureBindings(before.bindings);
  await checkVersion();
  const latest=await api('/settings');
  assert.deepEqual(latest.bindings,before.bindings,'Concurrent settings change: stop');
  const form=new FormData();
  form.set('settings',JSON.stringify({...before,bindings,annotations:{'workers/message':'Close paid AI, billing and uncertified OAuth guards; application code unchanged'}}));
  await api('/settings','PATCH',form);
  const after=await api('/settings');
  for(const [name,value] of Object.entries(closedFlags)) {
    const b=after.bindings.find(b=>b.name===name);
    assert.ok(b?.type==='plain_text' && b.text===value,'Guard verification failed: '+name);
  }
  for(const b of before.bindings.filter(b=>!Object.hasOwn(closedFlags,b.name))) {
    assert.deepEqual(after.bindings.find(item=>item.name===b.name),b,'Unrelated binding changed');
  }
  console.log('PROD_GUARDS_CLOSED_AND_UNRELATED_BINDINGS_PRESERVED');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e=>{console.error(e instanceof assert.AssertionError ? e.message.split('\n')[0] : 'Production guard closure failed');process.exitCode=1;});
}
