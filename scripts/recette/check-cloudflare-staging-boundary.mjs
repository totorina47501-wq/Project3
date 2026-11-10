import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
// Refuse toute configuration externe, payante ou pointant vers la production.
const prod=JSON.parse(readFileSync(resolve('wrangler.jsonc'),'utf8'));
const st=JSON.parse(readFileSync(resolve('wrangler.staging.jsonc'),'utf8'));
const deny=(why)=>{throw Error('STAGING_BOUNDARY_FAILED: '+why)};
if(prod.name!=='mentioncheck')deny('worker production inattendu');
if(st.name!=='mentioncheck-staging'||st.name===prod.name||st.main!=='.open-next/worker.js')deny('worker non isolé');
if(st.vars?.NEXT_PUBLIC_SUPABASE_URL!=='https://ukvgnkxgzyhswgpnvyzz.supabase.co')deny('projet Supabase non isolé');
if(st.vars?.NEXT_PUBLIC_APP_URL!=='https://mentioncheck-staging.toto-rina47501.workers.dev')deny('domaine inattendu');
const forbidden=['containers','durable_objects','queues','triggers','r2_buckets','kv_namespaces','d1_databases','hyperdrive','unsafe'];
for(const key of forbidden)if(Object.hasOwn(st,key))deny('binding interdit: '+key);
for(const key of ['OPENAI_TEXT_ENABLED','OPENAI_VISION_ENABLED','OPENAI_AUDIO_ENABLED','OPENAI_EMBEDDINGS_ENABLED','BILLING_ENABLED','MEDIA_PROCESSING_ENABLED','MEDIA_CLOUDFLARE_RUNNER_ENABLED','MEDIA_AI_ENABLED','MEDIA_RETENTION_ENABLED']){
 if(st.vars?.[key]!=='false')deny('feature payante active: '+key);
}
if(st.vars?.STRIPE_WEBHOOK_ENABLED!=='true'||st.vars?.STRIPE_MODE!=='test')
  deny('le webhook staging ne doit traiter que Stripe Sandbox');
if(st.vars?.OPENAI_PAUSED!=='true'||st.vars?.MEDIA_RUNNER_PAUSED!=='true')deny('coupe circuit manquant');
if(st.workers_dev!==true||st.keep_vars!==true||st.assets?.binding!=='ASSETS')deny('config Worker incomplète');
for(const key of Object.keys(st.vars||{}))if(/(?:api[_-]?key|service[_-]?role|service[_-]?key|anon[_-]?key|secret|token|password|credential)/i.test(key))deny('clé dans le dépôt: '+key);
const serialized=JSON.stringify(st);
if(serialized.includes('zcztvberuihphqklhjsr')||serialized.includes('mentioncheck.toto-rina47501.workers.dev'))deny('référence production');
const namespaces=new Set((prod.ratelimits||[]).map(x=>x.namespace_id));
if((st.ratelimits||[]).some(x=>namespaces.has(x.namespace_id)))deny('rate limit partagé avec la production');
for(const n of ['API_SOLO_LIMITER','API_PAID_LIMITER'])if(!(st.ratelimits||[]).some(x=>x.name===n))deny('binding limiteur absent');
console.log('STAGING_BOUNDARY_OK : Worker distinct, RLS Supabase indépendant, IA/Checkout live/containers/purge off ; webhook Sandbox signé');
