import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const prod=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
const staging=JSON.parse(readFileSync('wrangler.staging.jsonc','utf8'));

describe('Domaine officiel MentionCheck sans ouverture commerciale',()=>{
  it('raccorde uniquement le worker production au domaine apex',()=>{
    expect(prod.name).toBe('mentioncheck');
    expect(prod.routes).toEqual([{pattern:'mentioncheck.app',custom_domain:true}]);
    expect(prod.vars.NEXT_PUBLIC_APP_URL).toBe('https://mentioncheck.app');
    expect(prod.workers_dev).toBe(true);
  });
  it('conserve la séparation staging, previews et les portes de paiement',()=>{
    expect(staging.name).toBe('mentioncheck-staging');
    expect(staging.routes).toBeUndefined();
    expect(staging.vars.NEXT_PUBLIC_APP_URL).toBe('https://mentioncheck-staging.toto-rina47501.workers.dev');
    expect(prod.previews.vars.NEXT_PUBLIC_APP_URL).toBe('https://mentioncheck-staging.toto-rina47501.workers.dev');
    expect(prod.vars.BILLING_ENABLED).toBe('false');
    expect(prod.vars.STRIPE_WEBHOOK_ENABLED).toBe('false');
    expect(prod.vars.STRIPE_LIVE_APPROVED).toBe('false');
  });
});
