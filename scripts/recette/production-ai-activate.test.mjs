import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {aiOnly,requiredOff,planAiSettings} from './production-ai-activate.mjs';

function valid() {
  const bindings=[
    {name:'NEXT_PUBLIC_APP_URL',type:'plain_text',text:'https://mentioncheck.app'},
    {name:'OPENAI_API_KEY',type:'secret_text'},
    {name:'MEDIA_RUNNER',type:'durable_object_namespace',class_name:'MediaRunner',namespace_id:'existing-id'},
    {name:'STRIPE_SECRET_KEY',type:'secret_text'},
    ...requiredOff.map(name=>({name,type:'plain_text',text:'false'})),
    {name:'OPENAI_PAUSED',type:'plain_text',text:'true'},
    {name:'OPENAI_TEXT_ENABLED',type:'plain_text',text:'false'},
    {name:'OPENAI_VISION_ENABLED',type:'plain_text',text:'false'},
    {name:'STRIPE_MODE',type:'plain_text',text:'live'},
    {name:'STRIPE_LIVE_BUYER_SCOPE',type:'plain_text',text:'general_public'},
  ];
  return {bindings,compatibility_date:'2026-11-05',exports:{MediaRunner:{type:'durable-object',storage:'sqlite'}}};
}
test('never alters Stripe, media, audio, embeddings, secrets or Worker namespace',()=>{
 const before=valid();
 const result=planAiSettings(before);
 assert.deepEqual(Object.fromEntries(result.bindings.filter(b=>Object.hasOwn(aiOnly,b.name)).map(b=>[b.name,b.text])),aiOnly);
 assert.equal(result.bindings.find(b=>b.name==='STRIPE_SECRET_KEY').type,'inherit');
 assert.equal(result.bindings.find(b=>b.name==='OPENAI_API_KEY').type,'inherit');
 assert.deepEqual(result.bindings.find(b=>b.name==='MEDIA_RUNNER'),before.bindings.find(b=>b.name==='MEDIA_RUNNER'));
 for(const name of requiredOff)assert.equal(result.bindings.find(b=>b.name===name).text,'false');
 assert.equal(result.bindings.find(b=>b.name==='STRIPE_LIVE_BUYER_SCOPE').text,'general_public');
 assert.equal(result.compatibility_date,before.compatibility_date);
 assert.deepEqual(result.exports,before.exports);
});
test('refuses missing or unsafe production guards',()=>{
 for(const name of requiredOff){
   const before=valid();before.bindings.find(x=>x.name===name).text='true';
   assert.throws(()=>planAiSettings(before),/must stay OFF/);
 }
 const wrongDomain=valid();wrongDomain.bindings.find(x=>x.name==='NEXT_PUBLIC_APP_URL').text='https://example.test';
 assert.throws(()=>planAiSettings(wrongDomain),/Wrong production domain/);
 const noNamespace=valid();noNamespace.bindings= noNamespace.bindings.filter(x=>x.name!=='MEDIA_RUNNER');
 assert.throws(()=>planAiSettings(noNamespace),/MediaRunner namespace/);
 const duplicate=valid();duplicate.bindings.push({...duplicate.bindings[0]});
 assert.throws(()=>planAiSettings(duplicate),/Duplicate binding/);
 const badFlag=valid();badFlag.bindings.find(x=>x.name==='OPENAI_PAUSED').type='secret_text';
 assert.throws(()=>planAiSettings(badFlag),/AI flag must be plain text/);
});
test('activation workflow is separate from read-only diagnostics, no paid OpenAI request',()=>{
 const code=readFileSync(new URL('./production-ai-activate.mjs',import.meta.url),'utf8');
 const flow=readFileSync(new URL('../../.github/workflows/mentioncheck-ai-production-activate.yml',import.meta.url),'utf8');
 assert.match(code,/ACTIVATE_PRODUCTION_AI/);
 assert.match(code,/OPENAI_API_KEY/);
 assert.match(code,/PROD_OPENAI_COST_CAP_NOT_VERIFIED/);
 assert.doesNotMatch(code,/chat\.completions|embeddings\.create|api\.openai\.com/);
 assert.match(flow,/secrets\.MENTIONCHECK_PROD_CLOUDFLARE_API_TOKEN/);
 assert.doesNotMatch(flow,/secrets\.MENTIONCHECK_STAGING_CLOUDFLARE_API_TOKEN/);
 assert.match(flow,/github\.ref == 'refs\/heads\/main'/);
 assert.doesNotMatch(flow,/npx\s+(?:wrangler\s+deploy|@opennextjs\/cloudflare\s+deploy)/);
});
