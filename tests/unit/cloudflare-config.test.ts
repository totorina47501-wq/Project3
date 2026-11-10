import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
describe('Configuration Cloudflare sécurisée',()=>{
  it('préserve les variables runtime créées depuis le tableau de bord',()=>{
    const config=JSON.parse(readFileSync(resolve(process.cwd(),'wrangler.jsonc'),'utf8')) as {name:string;keep_vars:boolean;vars:Record<string,string>;previews:{vars:Record<string,string>}};
    expect(config.name).toBe('mentioncheck');
    expect(config.keep_vars).toBe(true);
    expect(config.vars).toEqual({
      MEDIA_JOBS_SCHEMA_READY:'true',MEDIA_PROCESSING_ENABLED:'true',
      MEDIA_CLOUDFLARE_RUNNER_ENABLED:'true',MEDIA_AI_ENABLED:'false',
      MEDIA_AI_SCHEMA_READY:'true',OPENAI_AUDIO_ENABLED:'false',
      OPENAI_PAUSED:'false',OPENAI_TEXT_ENABLED:'true',
      OPENAI_VISION_ENABLED:'true',OPENAI_EMBEDDINGS_ENABLED:'false',
      PROMO_SOLO_ENABLED:'false',
      BILLING_ENABLED:'false',STRIPE_WEBHOOK_ENABLED:'false',
      STRIPE_MODE:'live',
      STRIPE_PRICE_SOLO:'price_1UaKLwCdRRAa9LkpiXUiv0wc',
      STRIPE_PRICE_PRO:'price_1UaKLyCdRRAa9Lkp5daPFLZK',
      STRIPE_PRICE_STUDIO:'price_1UaKM0CdRRAa9Lkptx9oZCS8',
      STRIPE_LIVE_APPROVED:'false',
    });
    expect(config.previews.vars.PROMO_SOLO_ENABLED).toBe('false');
    expect(config.previews.vars.OPENAI_PAUSED).toBe('true');
    expect(config.previews.vars.OPENAI_TEXT_ENABLED).toBe('false');
    expect(config.previews.vars.OPENAI_VISION_ENABLED).toBe('false');
    expect(config.previews.vars.BILLING_ENABLED).toBe('false');
    expect(config.vars).not.toHaveProperty('OPENAI_API_KEY');
    expect(config.vars.BILLING_ENABLED).toBe('false');
    expect(config.vars.STRIPE_WEBHOOK_ENABLED).toBe('false');
    expect(config.vars.STRIPE_LIVE_APPROVED).toBe('false');
    expect(JSON.stringify(config.vars)).not.toMatch(/sk_live_|sk_test_|whsec_/);
    // Activation à la demande sans audio / embeddings ni média IA automatique.
    // La clé reste un secret du Worker, jamais une variable publiée dans Git.
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
