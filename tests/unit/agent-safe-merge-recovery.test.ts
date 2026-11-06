import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const code=readFileSync('.github/workflows/mentioncheck-agent-automerge.yml','utf8');
describe('Safe Copilot recovery policy',()=>{
  it('runs only from trusted main with bounded schedule',()=>{
    expect(code).toContain("cron: '10,40 * * * *'");
    expect(code).toContain("github.ref == 'refs/heads/main'");
    expect(code).toContain('if (checked >= 10) break');
    expect(code).not.toContain('actions/checkout@');
  });
  it('checks exact CI SHA, both jobs, agent completion and allowlisted files',()=>{
    expect(code).toContain('r.head_sha===sha');
    expect(code).toContain("ci.conclusion!=='success'");
    expect(code).toContain("agent.conclusion!=='success'");
    expect(code).toContain("j.name===name && j.conclusion==='success'");
    expect(code).toContain("latest.head.sha!==sha");
    expect(code).toContain("merge_method:'squash',sha");
    expect(code).toContain('files.length<=30');
  });
});
