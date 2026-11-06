import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const file = (name: string) =>
  readFileSync(resolve(process.cwd(), '.github/workflows', name), 'utf8');
const codex = file('mentioncheck-codex-dispatch.yml');
const copilot = file('mentioncheck-agent-dispatch.yml');

describe('Codex/Copilot separation contracts', () => {
  it('isolates Codex queue and never creates a second concurrent session', () => {
    expect(codex).toContain("cron: '5,35 * * * *'");
    expect(codex).toContain("default: true");
    expect(codex).toContain("agent:codex");
    expect(codex).toContain("agent:approved");
    expect(codex).toContain("activeIssue || activePr");
    expect(codex).toContain("const dryRun");
    expect(codex).toContain("has an open linked PR; skipping");
  });
  it('requires Codex identity and checks persistence without auto-merge', () => {
    expect(codex).toContain("assignees:['Codex']");
    expect(codex).toContain("Codex assignee not persisted");
    expect(codex).toContain("confirm session and PR separately");
    expect(codex).not.toContain("mergePullRequest");
    expect(codex).not.toContain("actions/checkout@");
  });
  it('prevents Copilot taking Codex-labeled or assigned issues', () => {
    expect(copilot).toContain('select(any(.labels[]?; .name == "agent:codex") | not)');
    expect(copilot).toContain('select(any(.assignees[]?; .login == "Codex") | not)');
    expect(copilot).toContain('index("agent:codex") == null');
  });
});
