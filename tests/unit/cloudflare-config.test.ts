import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
describe('Configuration Cloudflare sécurisée',()=>{
  it('préserve les variables runtime créées depuis le tableau de bord',()=>{
    const config=JSON.parse(readFileSync(resolve(process.cwd(),'wrangler.jsonc'),'utf8')) as Record<string,unknown>;
    expect(config.name).toBe('mentioncheck');
    expect(config.keep_vars).toBe(true);
    expect(config).not.toHaveProperty('vars');
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
