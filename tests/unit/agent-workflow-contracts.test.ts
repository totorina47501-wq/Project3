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
    expect(dispatch).toContain('issues:\n    types: [opened, labeled, closed]');
    expect(dispatch).toContain('pull_request:\n    types: [closed]');
    expect(dispatch).toContain('default: true');
    expect(dispatch).toContain("MAX_ACTIVE: '4'");
    expect(dispatch).toContain('assigned=0');
    expect(dispatch).toContain('active=$((active + 1))');
    expect(dispatch).toContain('assigned=$((assigned + 1))');
    expect(dispatch).toContain('Capacity reached after assignment');
    expect(dispatch).toContain('Dispatched $assigned Copilot mission(s)');
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

  it('libère les slots uniquement après fusion confirmée d’une PR Copilot liée', () => {
    expect(dispatch).toContain('merged_prs="$(gh api');
    expect(dispatch).toContain('.merged_at != null');
    expect(dispatch).toContain('.user.login == "Copilot"');
    expect(dispatch).toContain('.base.ref == "main"');
    expect(dispatch).toContain('.head.repo.full_name == $repo');
    expect(dispatch).toContain('select(any(.labels[]?; .name == "agent:approved"))');
    expect(dispatch).toContain('gh api --method PATCH "repos/$REPO/issues/$completed_number"');
    expect(dispatch).toContain('-f state=closed -f state_reason=completed');
    expect(dispatch).toContain('Closed completed Copilot issue');
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
    expect(agentMerge).toContain('tests/*|workers/media-jobs/tests/*.test.mjs|docs/*.md|docs/*/*.md|docs/work-registry.json');
    expect(agentMerge).toContain('workers\\/media-jobs\\/tests\\/[^/]+\\.test\\.mjs');
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

  it('relance la récupération après CI réussie même sans cron fiable', () => {
    expect(agentMerge).toContain('    needs: merge');
    expect(agentMerge).toContain('always()');
    expect(agentMerge).toContain("needs.merge.result != 'failure'");
    expect(agentMerge).toContain("github.event.workflow_run.event == 'pull_request'");
    expect(agentMerge).toContain("github.event.workflow_run.event == 'push'");
    expect(agentMerge).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(agentMerge).toContain("github.event_name == 'schedule'");
    expect(agentMerge).toContain("github.ref == 'refs/heads/main'");
    expect(agentMerge).toContain('return; // main may advance');
  });

  it('continue après fusion robot sans dépendre des événements push ou PR fermée', () => {
    const ci = workflow('ci.yml');
    expect(ci).toContain('  workflow_dispatch:');
    expect(ci).toContain('Cache Chromium Playwright');
    expect(ci).toContain('npx playwright install chromium');
    expect(ci).not.toContain('npx playwright install --with-deps chromium');
    expect(agentMerge).toContain('  actions: write');
    expect(agentMerge).toContain('actions/workflows/ci.yml/dispatches');
    expect(agentMerge).toContain("workflow_id:'ci.yml',ref:'main'");
    expect(agentMerge).toContain("github.event.workflow_run.event == 'workflow_dispatch'");
    expect(agentMerge).toContain("workflow_id:'mentioncheck-agent-dispatch.yml',ref:'main',inputs:{dry_run:'false'}");
    expect(agentMerge).toContain('current===source.head_sha');
    expect(agentMerge).toContain('source.head_branch===\'main\'');
    expect(agentMerge).not.toContain('actions/checkout@');
  });

  it('réveille la récupération quand Copilot finit après la CI ou met sa PR à jour', () => {
    expect(agentMerge).toContain('workflows: ["MentionCheck CI", "Running Copilot cloud agent"]');
    expect(agentMerge).toContain('pull_request_target:');
    expect(agentMerge).toContain('types: [ready_for_review, edited, synchronize]');
    expect(agentMerge).toContain("github.event.pull_request.user.login == 'Copilot'");
    expect(agentMerge).toContain("github.event.workflow_run.name == 'Running Copilot cloud agent'");
    expect(agentMerge).toContain("github.ref == 'refs/heads/main'");
    expect(agentMerge).not.toContain('actions/checkout@');
  });

  it('ne fusionne le code UI limité que si issue approuvée, source et diff sûrs', () => {
    expect(agentMerge).toContain('new Set(closingRefs).size!==1');
    expect(agentMerge).not.toContain('closingRefs.length!==1');
    expect(agentMerge).toContain("ticket.state!=='open'");
    expect(agentMerge).toContain("l.name==='agent:approved'");
    expect(agentMerge).toContain("release:evidence-required");
    expect(agentMerge).toContain("security:manual");
    expect(agentMerge).toContain("const isUi=(path)=>");
    expect(agentMerge).toContain('const unsafeChange=');
    expect(agentMerge).toContain("['added','modified'].includes(f.status)");
    expect(agentMerge).toContain('f.additions>250');
    expect(agentMerge).toContain('!f.patch');
    expect(agentMerge).toContain("!unsafeChange.test(added)");
    expect(agentMerge).toContain("github.rest.repos.getCommit({owner,repo,ref:sha})");
    expect(agentMerge).toContain("latest.head.sha!==sha");
    expect(agentMerge).toContain("workflow_id:'ci.yml',ref:'main'");
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
