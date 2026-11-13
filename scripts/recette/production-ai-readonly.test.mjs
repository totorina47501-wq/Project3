import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const script=readFileSync(new URL('./production-ai-readonly.mjs',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../../.github/workflows/mentioncheck-ai-production-readonly.yml',import.meta.url),'utf8');
test('diagnostic strictement lecture seule sans appel OpenAI ni écriture Cloudflare',()=>{
  assert.match(script,/method:'GET'/);
  assert.doesNotMatch(script,/method:\s*['"](?:PUT|POST|PATCH|DELETE)['"]/i);
  assert.doesNotMatch(script,/console\.log\(\s*(?:token|settings|secrets)\b/i);
  assert.match(script,/OPENAI_API_KEY/);
  assert.doesNotMatch(workflow,/wrangler\s+(?:deploy|secret\s+put)|opennextjs-cloudflare deploy/i);
  assert.match(workflow,/permissions:\n  contents: read/);
  assert.match(workflow,/github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/MENTIONCHECK_PROD_CLOUDFLARE_READ_TOKEN/);
  assert.doesNotMatch(workflow,/secrets\\.MENTIONCHECK_STAGING_CLOUDFLARE_API_TOKEN/);
});

import { closureBindings, closureSettings, closedFlags } from './production-close-guards.mjs';
test('closure inherits every unrelated binding and never exposes secret values',()=>{
  const bindings=[{name:'OPENAI_API_KEY',type:'secret_text'},{name:'DB',type:'hyperdrive',id:'private-id'},{name:'OPENAI_PAUSED',type:'plain_text',text:'false'}];
  const result=closureBindings(bindings);
  assert.deepEqual(result.slice(0,2),[{name:'OPENAI_API_KEY',type:'inherit'},{name:'DB',type:'hyperdrive',id:'private-id'}]);
  assert.equal(result.length,2+Object.keys(closedFlags).length);
  assert.equal(result.find(b=>b.name==='OPENAI_PAUSED').text,'true');
  assert.ok(result.filter(b=>b.type==='plain_text' && b.name!=='OPENAI_PAUSED').every(b=>b.text==='false'));
  assert.throws(()=>closureBindings([]));
  assert.throws(()=>closureBindings([{name:'OPENAI_PAUSED',type:'secret_text'}]));
  assert.throws(()=>closureBindings([bindings[0],bindings[0]]));
});

test('closure preserves the provisioned MediaRunner and its existing sqlite lifecycle',()=>{
  const runner={name:'MEDIA_RUNNER',type:'durable_object_namespace',class_name:'MediaRunner',namespace_id:'existing-namespace'};
  const before={bindings:[runner,{name:'KEY',type:'secret_text'}],compatibility_date:'2026-01-01'};
  const after=closureSettings(before);
  assert.deepEqual(after.bindings.find(b=>b.name==='MEDIA_RUNNER'),runner);
  assert.deepEqual(after.exports,{MediaRunner:{type:'durable-object',storage:'sqlite'}});
  assert.equal(after.compatibility_date,before.compatibility_date);
  assert.throws(()=>closureSettings({bindings:[{...runner,namespace_id:undefined}]}));
  assert.throws(()=>closureSettings({...before,exports:{Other:{type:'durable-object',storage:'sqlite'}}}));
});
