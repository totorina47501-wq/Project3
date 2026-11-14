// One-shot operator-approved AI activation on the existing production Worker.
// No application upload, Stripe mutation, migration, OpenAI model call or secret disclosure.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

export const aiOnly = Object.freeze({
  OPENAI_PAUSED: 'false',
  OPENAI_TEXT_ENABLED: 'true',
  OPENAI_VISION_ENABLED: 'true',
});
export const requiredOff = Object.freeze([
  'OPENAI_AUDIO_ENABLED', 'OPENAI_EMBEDDINGS_ENABLED', 'MEDIA_AI_ENABLED',
  'BILLING_ENABLED', 'STRIPE_WEBHOOK_ENABLED', 'STRIPE_LIVE_APPROVED',
  'PROMO_SOLO_ENABLED',
]);
const account='f9b14d5d93b1fe8ef3982d3ddb87131d';
const root='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/mentioncheck';

export function planAiSettings(before) {
  assert.ok(before && Array.isArray(before.bindings) && before.bindings.length > 0, 'Production settings required');
  assert.equal(new Set(before.bindings.map(b=>b.name)).size, before.bindings.length, 'Duplicate binding');
  const byName=new Map(before.bindings.map(b=>[b.name,b]));
  for(const name of requiredOff) {
    const b=byName.get(name);
    assert.ok(b?.type==='plain_text' && b.text==='false', 'Unrelated production guard must stay OFF: '+name);
  }
  for(const name of Object.keys(aiOnly)) {
    const b=byName.get(name);
    assert.ok(b?.type==='plain_text' && (b.text==='false'||b.text==='true'), 'AI flag must be plain text: '+name);
  }
  assert.equal(byName.get('NEXT_PUBLIC_APP_URL')?.text,'https://mentioncheck.app','Wrong production domain');
  const runner=byName.get('MEDIA_RUNNER');
  assert.ok(runner?.type==='durable_object_namespace' && runner.class_name==='MediaRunner' && runner.namespace_id,
    'Existing MediaRunner namespace required');
  if(before.exports) assert.deepEqual(before.exports,{MediaRunner:{type:'durable-object',storage:'sqlite'}},'Unexpected Worker exports');
  const bindings=before.bindings.map(b=>{
    if(Object.hasOwn(aiOnly,b.name)) return {name:b.name,type:'plain_text',text:aiOnly[b.name]};
    return b.type.startsWith('secret_') ? {name:b.name,type:'inherit'} : {...b};
  });
  return {...before,bindings, exports:{MediaRunner:{type:'durable-object',storage:'sqlite'}},
    annotations:{'workers/message':'Operator approved AI text/vision only; Stripe and all other bindings preserved'}};
}

async function run() {
  assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,account,'Unexpected account');
  assert.equal(process.env.ACTIVATE_PRODUCTION_AI,'text-vision-only','Explicit activation required');
  const token=process.env.CLOUDFLARE_API_TOKEN;
  assert.ok(token,'Production write credential not connected');
  async function api(path,method='GET',body) {
    const response=await fetch(root+path,{method,body,headers:{Authorization:'Bearer '+token},
      signal:AbortSignal.timeout(20000)});
    let obj;
    try { obj=await response.json(); } catch { throw Error('Cloudflare non-JSON response, status '+response.status); }
    const codes=(obj.errors??[]).map(e=>Number(e.code)).filter(Number.isFinite).join(',');
    assert.ok(response.ok && obj.success===true,'Cloudflare '+method+' '+path+' HTTP '+response.status+' error codes='+codes);
    return obj.result;
  }
  async function stableVersion() {
    const deployments=await api('/deployments');
    const active=deployments?.deployments?.[0]?.versions;
    assert.equal(active?.length,1,'Split Worker deployment: stop');
    assert.equal(active[0].percentage,100,'Worker deployment not at 100 percent');
    const versions=await api('/versions');
    if(versions?.items?.length) assert.equal(versions.items[0].id,active[0].version_id,'Newer undeployed version: stop');
    return active[0].version_id;
  }
  const version=await stableVersion();
  const secrets=await api('/secrets');
  const secretNames=new Set((Array.isArray(secrets)?secrets:(secrets?.secrets??[])).map(s=>s?.name));
  assert.ok(secretNames.has('OPENAI_API_KEY'),'OpenAI API key name absent from production; stop');
  const before=await api('/settings');
  const requested=planAiSettings(before);
  const changed=Object.entries(aiOnly).some(([name,value])=>
    before.bindings.find(b=>b.name===name)?.text!==value);
  if(changed) {
    assert.equal(await stableVersion(),version,'Concurrent Worker deployment: stop');
    const latest=await api('/settings');
    assert.deepEqual(latest.bindings,before.bindings,'Concurrent binding change: stop');
    const form=new FormData();
    form.set('settings',JSON.stringify(requested));
    await api('/settings','PATCH',form);
  }
  const after=await api('/settings');
  for(const [name,value] of Object.entries(aiOnly)) {
    const b=after.bindings.find(item=>item.name===name);
    assert.ok(b?.type==='plain_text'&&b.text===value,'AI flag did not activate: '+name);
  }
  for(const b of before.bindings.filter(x=>!Object.hasOwn(aiOnly,x.name))) {
    const a=after.bindings.find(x=>x.name===b.name);
    assert.ok(a,'Unrelated binding missing: '+b.name);
    if(b.type.startsWith('secret_'))assert.equal(a.type,b.type,'Secret binding changed');
    else assert.deepEqual(a,b,'Unrelated binding changed: '+b.name);
  }
  console.log('PROD_AI_TEXT_VISION_FLAGS_ACTIVE');
  console.log('PROD_OTHERS_PRESERVED Stripe, audio, embeddings, media, staging untouched');
  console.log('PROD_OPENAI_COST_CAP_NOT_VERIFIED_IN_THIS_WORKFLOW');
  // Safe HTTP readiness request: no invocation of OpenAI or any authenticated user API.
  try {
    const probe=await fetch('https://mentioncheck.app/api/health/ai',{method:'GET',
      headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(10000)});
    console.log('PROD_AI_HTTP_READINESS '+probe.status);
  } catch { console.log('PROD_AI_HTTP_READINESS_UNVERIFIED'); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch(e=>{console.error(e instanceof assert.AssertionError?e.message.split('\n')[0]:'AI activation failed: '+e.message);
    process.exitCode=1;});
}
