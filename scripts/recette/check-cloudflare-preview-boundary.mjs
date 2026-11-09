// Contrat de Preview : aucune API IA/paiement ni ressource de production autorisée.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const worker=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
assert.equal(worker.name,'mentioncheck','Worker attendu');
const config=worker.previews;
assert.ok(config && typeof config==='object' && !Array.isArray(config),'Bloc previews obligatoire');
const vars=config.vars;
assert.ok(vars && typeof vars==='object','Variables preview explicites');
assert.equal(vars.NEXT_PUBLIC_SUPABASE_URL,'https://ukvgnkxgzyhswgpnvyzz.supabase.co');
assert.equal(vars.NEXT_PUBLIC_APP_URL,'https://mentioncheck-staging.toto-rina47501.workers.dev');
assert.equal(vars.OPENAI_PAUSED,'true');
for(const key of ['OPENAI_TEXT_ENABLED','OPENAI_VISION_ENABLED','OPENAI_AUDIO_ENABLED',
'OPENAI_EMBEDDINGS_ENABLED','BILLING_ENABLED','MEDIA_PROCESSING_ENABLED',
'MEDIA_CLOUDFLARE_RUNNER_ENABLED','MEDIA_AI_ENABLED','MEDIA_RETENTION_ENABLED']){
 assert.equal(vars[key],'false','Fonction active en Preview: '+key);
}
assert.equal(vars.MEDIA_RUNNER_PAUSED,'true');
for(const key of Object.keys(vars)){
 assert.ok(!/(?:api[_-]?key|service[_-]?role|service[_-]?key|anon[_-]?key|secret|token|password|credential)/i.test(key),'Secret déclaré en Preview: '+key);
}
for(const key of ['containers','durable_objects','kv_namespaces','r2_buckets','d1_databases',
'queues','hyperdrive','services','vars_production'])assert.equal(config[key],undefined,
 'Binding à revue de sécurité requise: '+key);
assert.ok(!JSON.stringify(config).includes('zcztvberuihphqklhjsr'),
 'Référence Supabase production interdite en Preview');
console.log('PREVIEWS_FAIL_CLOSED_BOUNDARY_OK : bloc présent, Supabase staging et services payants OFF');
