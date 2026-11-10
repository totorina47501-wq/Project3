import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const script=readFileSync(new URL('./production-ai-readonly.mjs',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../../.github/workflows/mentioncheck-ai-production-readonly.yml',import.meta.url),'utf8');
test('diagnostic strictement lecture seule sans appel OpenAI ni écriture Cloudflare',()=>{
  assert.match(script,/method:'GET'/);
  assert.doesNotMatch(script,/method:\s*['"](?:PUT|POST|PATCH|DELETE)['"]/i);
  assert.doesNotMatch(script,/console\.log\(\s*(?:token|settings|secrets)\b/i);
  assert.match(script,/OPENAI_API_KEY/);
  assert.doesNotMatch(workflow,/wrangler\s+(?:deploy|secret\s+put)|opennextjs-cloudflare deploy/i);
  assert.match(workflow,/permissions:\n  contents: read/);
  assert.match(workflow,/github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/MENTIONCHECK_PROD_CLOUDFLARE_READ_TOKEN/);
  assert.doesNotMatch(workflow,/secrets\\.MENTIONCHECK_STAGING_CLOUDFLARE_API_TOKEN/);
});
