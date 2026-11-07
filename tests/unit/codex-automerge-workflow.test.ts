import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';

const safe=readFileSync(resolve(process.cwd(),'.github/workflows/mentioncheck-codex-safe-automerge.yml'),'utf8');

describe('Codex safe auto-merge contract',()=>{
  it('runs only on trusted workflow events and never executes PR code with write token',()=>{
    expect(safe).toContain('workflow_run:');
    expect(safe).toContain('cron:');
    expect(safe).toContain("context.ref!=='refs/heads/main'");
    expect(safe).not.toContain('actions/checkout@');
    expect(safe).toContain("source?.conclusion!=='success'");
  });
  it('checks Codex app identity, branch and safe-file restrictions',()=>{
    expect(safe).toContain("pr.user?.login!=='Codex'");
    expect(safe).toContain("startsWith('codex/')");
    expect(safe).toContain("files.length<=20");
    expect(safe).toContain("['added','modified']");
    expect(safe).toContain("f.additions<=300&&f.deletions<=300");
    expect(safe).toContain("12-privacy-security");
    expect(safe).toContain("17-ci-release-gates");
    expect(safe).toContain("50-codex-dispatch");
    expect(safe).not.toContain("factory:auto-merge-safe");
  });
  it('requires Codex completed and exact green PR CI on the SHA before protected merge',()=>{
    expect(safe).toContain("r.name==='Running OpenAI Codex'");
    expect(safe).toContain("r.head_sha===sha");
    expect(safe).toContain("r.event==='pull_request'");
    expect(safe).toContain("ci.conclusion!=='success'");
    expect(safe).toContain("j.name===name&&j.conclusion==='success'");
    expect(safe).toContain("latest.head.sha!==sha");
    expect(safe).toContain("merge_method:'squash',sha");
    expect(safe).toContain("GitHub refused protected Codex merge");
  });
  it('reconciles only verified Codex issues and restarts backlog after green main',()=>{
    expect(safe).toContain("issue.labels?.some(l=>l.name==='agent:codex')");
    expect(safe).toContain("state:'closed',state_reason:'completed'");
    expect(safe).toContain("workflow_id:'ci.yml'");
    expect(safe).toContain("workflow_id:'mentioncheck-codex-dispatch.yml'");
    expect(safe).toContain("current===source.head_sha");
  });
});
