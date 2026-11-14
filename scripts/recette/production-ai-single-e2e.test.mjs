import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {qaPrefix,prompt,responseSummary} from './production-ai-single-e2e.mjs';
test('the test uses a synthetic caption and disposable QA email only',()=>{
 assert.equal(qaPrefix,'mentioncheckcorp+mcqa-');
 assert.match(prompt,/café imaginaire/);
 const source=readFileSync(new URL('./production-ai-single-e2e.mjs',import.meta.url),'utf8');
 assert.match(source,/randomBytes\(32\)/);
 assert.match(source,/i===0\?38000:37000/);
 assert.match(source,/execution:'ai',mediaType:'none'/);
 assert.doesNotMatch(source,/stripe\/checkout|secret.*log|console\.log\(email|console\.log\(password/);
 assert.equal((source.match(/fetch\(app\+'\/api\/check'/g)||[]).length,1);
});
test('SSE requires exactly one full completion and validates a bounded score',()=>{
 const full='event: scan_text\ndata: {"status":"complete"}\n\n'
  +'event: done\ndata: {"analysisMode":"full","score":91,"aiFlags":[{"title":"fixture"}],"rewrite":{"rewrittenCaption":"Publicité : fixture"},"warnings":[]}\n\n';
 assert.deepEqual(responseSummary(full),{completed:true,mode:'full',scoreValid:true,aiFlagCount:1,rewritePresent:true,warningCount:0});
 assert.equal(responseSummary('event: error\ndata: {"message":"down"}\n\n').completed,false);
 assert.equal(responseSummary(full+full).completed,false);
 assert.equal(responseSummary('event: done\ndata: {"analysisMode":"full","score":999}\n\n').scoreValid,false);
});

test('GitHub workflow YAML step names contain no unquoted spaced colon',()=>{
 const yaml=readFileSync(new URL('../../.github/workflows/mentioncheck-ai-production-single-qa.yml',import.meta.url),'utf8');
 assert.match(yaml,/pull_request:/);
 assert.match(yaml,/types: \[opened\]/);
 assert.match(yaml,/^\s+false &&$/m,'Production paid test must stay disarmed after the one-shot run');
 assert.doesNotMatch(yaml,/^\s+- name: [^\n]* : [^\n]*$/m);
});
