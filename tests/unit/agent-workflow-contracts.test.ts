import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const workflow = (name: string) =>
  readFileSync(resolve(process.cwd(), '.github/workflows', name), 'utf8');

const dispatch = workflow('mentioncheck-agent-dispatch.yml');
const agentMerge = workflow('mentioncheck-agent-automerge.yml');
const docsMerge = workflow('factory-safe-automerge.yml');

describe('Contrats statiques des workflows agents', () => {
  it('ne dispatch que les issues ouvertes explicitement approuvées et sans doublon', () => {
    expect(dispatch).toContain("cron: '0,30 * * * *'");
    expect(dispatch).toContain('issues:\n    types: [closed]');
    expect(dispatch).toContain('pull_request:\n    types: [closed]');
    expect(dispatch).toContain('default: true');
    expect(dispatch).toContain("MAX_ACTIVE: '2'");
    expect(dispatch).toContain('select(.pull_request == null and .state == "open")');
    expect(dispatch).toContain('index("agent:approved")');
    expect(dispatch).toContain('sort_by(.number)');
    expect(dispatch).toContain('[ "$active" -ge "$MAX_ACTIVE" ]');
    expect(dispatch).toContain('index("copilot-swe-agent[bot]")');
    expect(dispatch).toContain('Closes #N');
    expect(dispatch).toContain('COPILOT_DISPATCH_TOKEN');
    expect(dispatch).toContain('BLOCKED: Copilot assignment rejected');
    expect(dispatch).toContain('BLOCKED: Copilot assignee missing');
  });

  it('réserve le safe-code auto-merge aux PR Copilot admissibles et au SHA exact', () => {
    expect(agentMerge).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(agentMerge).toContain("github.event.workflow_run.event == 'pull_request'");
    expect(agentMerge).toContain('[ "$(jq -r .state <<< "$pr")" = open ]');
    expect(agentMerge).toContain('[ "$(jq -r .base.ref <<< "$pr")" = main ]');
    expect(agentMerge).toContain('[ "$(jq -r .head.repo.full_name <<< "$pr")" = "$REPO" ]');
    expect(agentMerge).toContain('[ "$(jq -r .user.login <<< "$pr")" = Copilot ]');
    expect(agentMerge).toContain('index("factory:auto-merge-safe") == null');
    expect(agentMerge).toContain('[ "$(jq -r .head.sha <<< "$pr")" = "$RUN_SHA" ]');
    expect(agentMerge).toContain('[ "$(gh api "repos/$REPO/pulls/$number" --jq \'.head.sha\')" = "$RUN_SHA" ]');
    expect(agentMerge).toContain('tests/*|docs/*.md|docs/*/*.md|docs/work-registry.json');
    expect(agentMerge).toContain('[ "$count" -gt 0 ] && [ "$count" -le 30 ]');
    expect(agentMerge).toContain('[ "$status" != removed ]');
    expect(agentMerge).toContain('[ "$status" != renamed ]');
    expect(agentMerge).toContain('[ "$additions" -le 500 ] && [ "$deletions" -le 500 ]');
    expect(agentMerge).toContain('grep -Fxq "$(printf \'quality\\tsuccess\')"');
    expect(agentMerge).toContain('grep -Fxq "$(printf \'Image du runner média (sans fournisseur)\\tsuccess\')"');
    expect(agentMerge).toContain('Running Copilot cloud agent');
    expect(agentMerge).toContain('-f merge_method=squash -f sha="$RUN_SHA"');
    expect(agentMerge).not.toContain('actions/checkout@');
  });

  it('réserve le workflow documentaire au label explicite et aux chemins permis', () => {
    expect(docsMerge).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(docsMerge).toContain('[ "$(jq -r \'.draft\' <<< "$pr")" = false ]');
    expect(docsMerge).toContain('[ "$(jq -r \'.base.ref\' <<< "$pr")" = main ]');
    expect(docsMerge).toContain('[ "$(jq -r \'.head.repo.full_name\' <<< "$pr")" = "$REPO" ]');
    expect(docsMerge).toContain('[ "$(jq -r \'.head.sha\' <<< "$pr")" = "$RUN_SHA" ]');
    expect(docsMerge).toContain('index("factory:auto-merge-safe") != null');
    expect(docsMerge).toContain('docs/*.md|docs/*/*.md');
    expect(docsMerge).toContain('docs/12-privacy-security.md');
    expect(docsMerge).toContain('docs/42-copilot-mobile-workflow.md');
    expect(docsMerge).toContain('[ "$latest" = "$RUN_SHA" ]');
    expect(docsMerge).toContain('-f merge_method=squash -f sha="$RUN_SHA"');
    expect(docsMerge).not.toContain('actions/checkout@');
  });
});
