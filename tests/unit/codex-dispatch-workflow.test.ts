import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const file = (name: string) =>
  readFileSync(resolve(process.cwd(), '.github/workflows', name), 'utf8');
const codex = file('mentioncheck-codex-dispatch.yml');
const copilot = file('mentioncheck-agent-dispatch.yml');

describe('Codex/Copilot separation contracts', () => {
  it('isolates Codex queue and caps concurrent missions at three', () => {
    expect(codex).toContain("cron: '5,35 * * * *'");
    expect(codex).toContain('types: [opened, labeled, closed]');
    expect(codex).toContain("default: true");
    expect(codex).toContain("hasLabel(i, 'agent:codex')");
    expect(codex).toContain("!hasLabel(i, 'agent:approved')");
    expect(codex).toContain('const MAX_ACTIVE = 3;');
    expect(codex).toContain("const activeIssues = issues.filter(i => !i.pull_request");
    expect(codex).toContain("const activePrs = prs.filter(p => p.state === 'open'");
    expect(codex).toContain('!activeIssues.some(i => closesIssue(p, i.number))');
    expect(codex).toContain('if (active >= MAX_ACTIVE) {');
    expect(codex).toContain('active += 1;');
    expect(codex).toContain('Codex capacity filled. Stop dispatch.');
    expect(codex).toContain('if (prs.some(pr => closesIssue(pr, number))) {');
    expect(codex).toContain("Issue #'+number+' has an open linked PR; skipping.");
    expect(codex).toContain("const dryRun = context.eventName === 'workflow_dispatch' &&");
    expect(codex).toContain("Dry-run: would assign Codex to #'+number");
  });
  it('requires Codex identity and checks persistence without auto-merge', () => {
    expect(codex).toContain("addAssigneesToAssignable");
    expect(codex).toContain("Codex GraphQL assignee not persisted");
    expect(codex).toContain("Confirm session and PR separately");
    expect(codex).toContain("identity.type !== 'Bot'");
    expect(codex).not.toContain("github.rest.issues.addAssignees(");
    expect(codex).not.toContain("mergePullRequest");
    expect(codex).not.toContain("actions/checkout@");
  });
  it('prevents Copilot taking Codex-labeled or assigned issues', () => {
    expect(copilot).toContain('select(any(.labels[]?; .name == "agent:codex") | not)');
    expect(copilot).toContain('select(any(.assignees[]?; .login == "Codex") | not)');
    expect(copilot).toContain('index("agent:codex") == null');
    expect(copilot).toContain('jq -e \'any(.assignees[]?; .login == "Codex") | not\'');
  });
});
