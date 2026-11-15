import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source=readFileSync(resolve(process.cwd(),'.github/workflows/mentioncheck-ci-auto-recovery.yml'),'utf8');
describe('MentionCheck CI auto-recovery — gates anti-doublons',()=>{
  it('ne s’exécute que depuis main après CI et à cadence bornée',()=>{
    expect(source).toContain('workflow_run:');
    expect(source).toContain('workflows: ["MentionCheck CI"]');
    expect(source).toContain("context.ref!=='refs/heads/main'");
    expect(source).toContain('concurrency:');
    expect(source).toContain('cancel-in-progress: false');
    expect(source).toContain('if(recovered+requested>=2)break');
    expect(source).toContain('mainRecovery=source?.name');
    expect(source).toContain('!mainRecovery && pr.head.sha!==source.head_sha');
    expect(source).not.toContain('actions/checkout@');
  });
  it('refuse les PR de fork, workflows modifiés, pauses et blocs réglementaires',()=>{
    expect(source).toContain("pr.head?.repo?.full_name!==owner+'/'+repo");
    expect(source).toContain("pr.base?.ref!=='main'");
    expect(source).toContain('release:evidence-required');
    expect(source).toContain('security:manual');
    expect(source).toContain('legal:blocked');
    expect(source).toContain('/EN PAUSE|PAUSED|BLOCKED/i');
    expect(source).toContain("^\\.github\\/");
    expect(source).toContain('ticket.state!==\'open\'');
    expect(source).toContain('activeAgentLabels.has(l.name)');
  });
  it('récupère une seule CI action_required sans jobs, ni déploiement',()=>{
    expect(source).toContain("latest.conclusion==='action_required' && !dispatched");
    expect(source).toContain('jobs.length!==0');
    expect(source).toContain("workflow_id:'ci.yml',ref:pr.head.ref");
    expect(source).toContain('runs.some(x=>x.event===\'workflow_dispatch\')');
    expect(source).not.toContain('@opennextjs/cloudflare deploy');
    expect(source).not.toContain('wrangler deploy');
  });
  it('borne retries et autopréparation de correctifs à la même PR',()=>{
    expect(source).toContain("(latest.run_attempt||1)===1");
    expect(source).toContain('rerun-failed-jobs');
    expect(source).toContain('HAS_COPILOT_TOKEN');
    expect(source).toContain('attempts.length>=2');
    expect(source).toContain("prefix+pr.head.sha+' -->'");
    expect(source).toContain('@copilot Corrige');
    expect(source).toContain('github.rest.issues.createComment');
    expect(source).not.toContain('github.rest.pulls.merge');
  });
});
