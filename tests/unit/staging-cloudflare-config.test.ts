import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
const st=JSON.parse(readFileSync('wrangler.staging.jsonc','utf8'));
const prod=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
const wf=readFileSync('.github/workflows/mentioncheck-staging-cloudflare.yml','utf8');
const guard=readFileSync('scripts/recette/check-cloudflare-staging-boundary.mjs','utf8');
describe('Cloudflare staging distinct et sans coût IA',()=>{
 it('isole le nom et le backend de production',()=>{
  expect(prod.name).toBe('mentioncheck');
  expect(st.name).toBe('mentioncheck-staging');
  expect(st.main).toBe('.open-next/worker.js');
  expect(st.vars.NEXT_PUBLIC_SUPABASE_URL).toBe('https://ukvgnkxgzyhswgpnvyzz.supabase.co');
  expect(JSON.stringify(st)).not.toContain('zcztvberuihphqklhjsr');
  expect(st.keep_vars).toBe(true);
 });
 it('désactive les traitements fournisseurs, conteneurs et cron',()=>{
  for(const key of ['containers','durable_objects','triggers','queues','r2_buckets','d1_databases']){
   expect(st).not.toHaveProperty(key);
  }
  for(const key of ['BILLING_ENABLED','OPENAI_TEXT_ENABLED','OPENAI_VISION_ENABLED','OPENAI_AUDIO_ENABLED','OPENAI_EMBEDDINGS_ENABLED','MEDIA_PROCESSING_ENABLED','MEDIA_CLOUDFLARE_RUNNER_ENABLED','MEDIA_AI_ENABLED','MEDIA_RETENTION_ENABLED']){
   expect(st.vars[key]).toBe('false');
  }
  expect(st.vars.OPENAI_PAUSED).toBe('true');
  expect(st.vars.MEDIA_RUNNER_PAUSED).toBe('true');
  expect(st.vars).not.toHaveProperty('SUPABASE_SERVICE_KEY');
 });
 it('réserve le déploiement au workflow_dispatch sur main avec secrets staging',()=>{
  expect(wf).toContain('workflow_dispatch:');
  expect(wf).not.toContain('\n  push:');
  expect(wf).not.toContain('\n  pull_request:');
  expect(wf).toContain("github.ref == 'refs/heads/main'");
  expect(wf).toContain("inputs.mode == 'publish'");
  expect(wf).toContain('npx @opennextjs/cloudflare deploy --config wrangler.staging.jsonc');
  expect(wf).toContain('secrets.MENTIONCHECK_STAGING_SUPABASE_SERVICE_KEY');
  expect(wf).not.toContain('deploy --config wrangler.jsonc');
  expect(guard).toContain('STAGING_BOUNDARY_OK');
 });
});
