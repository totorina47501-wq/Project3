import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const approval = readFileSync('.github/workflows/mentioncheck-copilot-ci-approval.yml', 'utf8');
const ci = readFileSync('.github/workflows/ci.yml', 'utf8');

describe('Copilot CI approval trust boundaries', () => {
  it('is scheduled only on trusted main with an isolated user token and no checkout', () => {
    expect(approval).toContain("cron: '10,40 * * * *'");
    expect(approval).toContain("github.ref == 'refs/heads/main'");
    expect(approval).toContain('secrets.COPILOT_DISPATCH_TOKEN');
    expect(approval).not.toContain('actions/checkout');
    expect(approval).not.toContain('pull_request_target:');
    expect(approval).not.toContain('pull_request:\n');
  });
  it('approves only Copilot PR workflows on the same SHA, repository and safe paths', () => {
    expect(approval).toContain("run.conclusion === 'action_required'");
    expect(approval).toContain("run.path === '.github/workflows/ci.yml'");
    expect(approval).toContain("pr.user?.login === 'Copilot'");
    expect(approval).toContain('pr.head?.repo?.full_name');
    expect(approval).toContain('pr.head?.sha === run.head_sha');
    expect(approval).toContain('eligiblePath(f.filename) || safePackageChange(f)');
    expect(approval).toContain('files.length <= 30');
    expect(approval).toContain('approved >= 2');
  });
  it('reduces all pull-request CI permissions to repository read-only', () => {
    expect(ci).toMatch(/permissions:\s*\n\s*contents: read/);
    expect(ci).not.toMatch(/permissions:\s*\n\s*contents: write/);
  });
});
