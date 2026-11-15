import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe,expect,it } from 'vitest';
const workflow=readFileSync(resolve(process.cwd(),'.github/workflows/mentioncheck-production-release-evidence.yml'),'utf8');
describe('Production release evidence never bypasses approval',()=>{
  it('scopes attestation to current main and successful CI with both jobs',()=>{
    expect(workflow).toContain("context.ref!=='refs/heads/main'");
    expect(workflow).toContain("source.head_sha!==current");
    expect(workflow).toContain("['push','workflow_dispatch'].includes(source.event)");
    expect(workflow).toContain("r.head_sha===current");
    expect(workflow).toContain("'Image du runner média (sans fournisseur)'");
    expect(workflow).toContain("j.conclusion==='success'");
  });
  it('requires completed Workers Build on exact commit and HTTPS smoke',()=>{
    expect(workflow).toContain('Workers Builds: mentioncheck');
    expect(workflow).toContain("link.hostname==='dash.cloudflare.com'");
    expect(workflow).toContain("/workers/services/view/mentioncheck/production/builds/");
    expect(workflow).toContain("!link.pathname.includes('/previews/')");
    expect(workflow).toContain('workers.conclusion!==\'success\'');
    expect(workflow).toContain('curl --fail --location');
    expect(workflow).toContain("https://mentioncheck.app$path");
    expect(workflow).toContain('does NOT prove exact version');
  });
  it('is read only with no Cloudflare mutation or tokens',()=>{
    expect(workflow).toContain('checks: read');
    expect(workflow).toContain('actions: read');
    expect(workflow).not.toContain('contents: write');
    expect(workflow).not.toContain('pull-requests: write');
    expect(workflow).not.toContain('actions/checkout@');
    expect(workflow).not.toContain('wrangler deploy');
    expect(workflow).not.toContain('CLOUDFLARE_API_TOKEN');
    expect(workflow).not.toContain('secrets.');
  });
});
