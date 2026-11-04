import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
describe('Manual Cloudflare workflow', () => {
  const yaml = readFileSync('.github/workflows/mentioncheck-cloudflare-operator.yml','utf8');
  it('is manual only', () => {
    expect(yaml).toContain('workflow_dispatch:');
    expect(yaml).not.toMatch(/\n  push:/);
    expect(yaml).not.toMatch(/\n  pull_request:/);
  });
  it('requires explicit paid indexing confirmation', () => {
    expect(yaml).toContain('INDEXER-5');
    expect(yaml).toContain('mia-preview');
    expect(yaml).toContain('mia-index-five');
    expect(yaml).toContain('CLOUDFLARE_API_TOKEN');
    expect(yaml).toContain('MIA_INDEX_TOKEN');
  });
});
