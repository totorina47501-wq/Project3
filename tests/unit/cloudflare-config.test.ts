import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
describe('Configuration Cloudflare sécurisée',()=>{
  it('préserve les variables runtime créées depuis le tableau de bord',()=>{
    const config=JSON.parse(readFileSync(resolve(process.cwd(),'wrangler.jsonc'),'utf8')) as Record<string,unknown>;
    expect(config.name).toBe('mentioncheck');
    expect(config.keep_vars).toBe(true);
    expect(config.vars).toEqual({MEDIA_JOBS_SCHEMA_READY:'true',MEDIA_PROCESSING_ENABLED:'true',MEDIA_CLOUDFLARE_RUNNER_ENABLED:'true',MEDIA_AI_ENABLED:'true',MEDIA_AI_SCHEMA_READY:'true'});
    // Seuls ces flags d'activation sont déclarés : les secrets runtime sont préservés.
  });
  it('génère le dossier standalone nécessaire au packaging OpenNext',()=>{
    const config=readFileSync(resolve(process.cwd(),'next.config.mjs'),'utf8');
    expect(config).toMatch(/output:\s*['"]standalone['"]/);
  });
  it('impose également keep-vars pour le script de déploiement OpenNext',()=>{
    const config=JSON.parse(readFileSync(resolve(process.cwd(),'package.json'),'utf8')) as {scripts:Record<string,string>};
    expect(config.scripts['deploy:cloudflare']).toContain('deploy -- --keep-vars');
  });
});

it('borne le conteneur média à une seule instance basic et conserve le point d’entrée OpenNext',()=>{
 const config=JSON.parse(readFileSync(resolve(process.cwd(),'wrangler.jsonc'),'utf8'));
 expect(config.containers).toEqual([{class_name:'MediaRunner',scheduling_policy:'default',image:'./workers/media-jobs/Dockerfile',image_build_context:'.',max_instances:1,instance_type:'basic',constraints:{jurisdiction:'eu'}}]);
 expect(config.main).toBe('workers/cloudflare-entry.mjs');
 expect(config.durable_objects.bindings).toContainEqual({name:'MEDIA_RUNNER',class_name:'MediaRunner'});
});
