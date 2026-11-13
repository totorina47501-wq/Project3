import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Buffer } from 'node:buffer';
import { runInNewContext } from 'node:vm';
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
    expect(codex).toContain('!activeIssues.some(i => referencesIssue(p, i.number))');
    expect(codex).toContain('if (active >= MAX_ACTIVE) {');
    expect(codex).toContain('active += 1;');
    expect(codex).toContain('Codex capacity filled. Stop dispatch.');
    expect(codex).toContain('if (prs.some(pr => referencesIssue(pr, number))) {');
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


// Execute the actual inline actions/github-script JavaScript with a mocked, read-only
// GitHub client. This catches regressions in slot counting, not just source strings.
type MissionIssue = {
  number: number;
  state: 'open';
  assignees: { login: string }[];
  labels: { name: string }[];
  body?: string;
};
type MissionPr = {
  state: 'open';
  user: { login: string };
  title: string;
  body: string;
};
const codexIssue = (number: number, assigned = true): MissionIssue => ({
  number,
  state: 'open',
  assignees: assigned ? [{ login: 'Codex' }] : [],
  labels: [{ name: 'agent:codex' }],
  body: assigned ? '' : '<!-- mentioncheck-work-id: solo-prod-cutover -->',
});
const codexPr = (issue: number, user = 'Codex'): MissionPr => ({
  state: 'open',
  user: { login: user },
  title: 'Work on existing PR',
  body: '- Refs #' + issue + ' (keep the issue open)',
});

async function simulateDryRun(issues: MissionIssue[], prs: MissionPr[], operationStatus = 'pending') {
  const section = codex.split('          script: |\n')[1];
  if (!section) throw new Error('Missing Codex inline workflow script');
  const script = section.split('\n')
    .map(line => line.startsWith('            ') ? line.slice(12) : line)
    .join('\n');
  const output: string[] = [];
  const rest = {
    issues: {
      listForRepo: () => undefined,
      get: async ({ issue_number }: { issue_number: number }) =>
        ({ data: issues.find(issue => issue.number === issue_number) }),
    },
    pulls: { list: () => undefined },
    repos: {
      getContent: async () => ({data:{
        type:'file',encoding:'base64',
        content:Buffer.from(JSON.stringify({operations:[
          {id:'solo-prod-cutover',status:operationStatus},
        ]})).toString('base64'),
      }}),
    },
  };
  const github = {
    rest,
    paginate: async (operation: unknown) =>
      operation === rest.issues.listForRepo ? issues : prs,
  };
  await (runInNewContext(
    '(async () => {\n' + script + '\n})()',
    {
      context: {
        repo: { owner: 'totorina47501-wq', repo: 'Project3' },
        eventName: 'workflow_dispatch',
        payload: { inputs: { dry_run: 'true' } },
      },
      github,
      Buffer,
      core: { info: (message: string) => output.push(message) },
      process: { env: { CODEX_DISPATCH_TOKEN: '' } },
    },
    { timeout: 1000 },
  ) as Promise<void>);
  return output;
}

describe('Codex dispatch capacity regression — 11 November 2026', () => {
  it('counts #16/#128 and #102/#130 once per mission when PR body says Refs', async () => {
    const output = await simulateDryRun(
      [codexIssue(16), codexIssue(102)],
      [codexPr(16), codexPr(102)],
    );
    expect(output).toContain('Codex occupied slots: 2 / 3');
    expect(output).not.toContain('Codex capacity reached. No assignment.');
  });
  it('does not spawn a duplicate mission if another PR references a candidate issue', async () => {
    const output = await simulateDryRun(
      [codexIssue(16), codexIssue(102), codexIssue(150, false)],
      [codexPr(16), codexPr(102), codexPr(150, 'Copilot')],
    );
    expect(output).toContain('Codex occupied slots: 2 / 3');
    expect(output).toContain('Issue #150 has an open linked PR; skipping.');
    expect(output).not.toContain('Dry-run: would assign Codex to #150');
  });
  it('still reserves a slot for an orphan Codex PR', async () => {
    const output = await simulateDryRun(
      [codexIssue(16), codexIssue(102)],
      [codexPr(16), codexPr(102), { ...codexPr(300), body: 'No linked issue' }],
    );
    expect(output).toContain('Codex occupied slots: 3 / 3');
    expect(output).toContain('Codex capacity reached. No assignment.');
  });
  it('retains a safe dry-run for a genuinely new unassigned Codex issue', async () => {
    const output = await simulateDryRun(
      [codexIssue(16), codexIssue(102), codexIssue(150, false)],
      [codexPr(16), codexPr(102)],
    );
    expect(output).toContain('Codex occupied slots: 2 / 3');
    expect(output).toContain('Dry-run: would assign Codex to #150');
  });
});

describe('Codex operational anti-duplication preflight', () => {
  it('refuses an already completed operation, without assigning', async () => {
    const output=await simulateDryRun(
      [codexIssue(16),codexIssue(102),codexIssue(150,false)],
      [codexPr(16),codexPr(102)],'done');
    expect(output.some(x=>x.includes('Blocked #150'))).toBe(true);
    expect(output).not.toContain('Dry-run: would assign Codex to #150');
  });
  it('refuses an unregistered issue missing the explicit work marker', async () => {
    const issue={...codexIssue(150,false),body:''};
    const output=await simulateDryRun([issue],[]);
    expect(output.some(x=>x.includes('Blocked #150'))).toBe(true);
  });
  it('refuses two concurrent issues for the same operational work-id', async () => {
    const output=await simulateDryRun([codexIssue(150,false),codexIssue(151,false)],[]);
    expect(output.some(x=>x.includes('duplicate open issue for work-id'))).toBe(true);
    expect(output.some(x=>x.includes('would assign Codex'))).toBe(false);
  });
});
