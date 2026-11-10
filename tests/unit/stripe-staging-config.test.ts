import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { billingGate, paidPriceId } from '../../lib/billing/config';

const readConfig = (filename: string) =>
  JSON.parse(readFileSync(resolve(process.cwd(), filename), 'utf8')) as {
    name: string; vars: Record<string, string>; previews?: { vars?: Record<string, string> };
  };

describe('MentionCheck Stripe Sandbox — isolation', () => {
  it('garde les paiements désactivés et associe les trois vrais tarifs de TEST à staging', () => {
    const staging = readConfig('wrangler.staging.jsonc');
    expect(staging.name).toBe('mentioncheck-staging');
    expect(staging.vars.BILLING_ENABLED).toBe('false');
    expect(staging.vars.STRIPE_WEBHOOK_ENABLED).toBe('true');
    expect(staging.vars.STRIPE_MODE).toBe('test');
    expect(staging.vars.STRIPE_PRICE_SOLO).toBe('price_1UaAGVCZ5rRirUf6Mwl2S9LU');
    expect(staging.vars.STRIPE_PRICE_PRO).toBe('price_1UaAGXCZ5rRirUf6yL7FJqSD');
    expect(staging.vars.STRIPE_PRICE_STUDIO).toBe('price_1UaAGZCZ5rRirUf63iKoncrM');
    expect(billingGate(staging.vars).enabled).toBe(false);
    expect(billingGate({...staging.vars,STRIPE_SECRET_KEY:'sk_test_fixture',
      STRIPE_WEBHOOK_SECRET:'whsec_fixture'},'webhook').enabled).toBe(true);
    expect(JSON.stringify(staging)).not.toMatch(/sk_(test|live)_|whsec_/);
  });
  it('autoriserait les prix de test uniquement avec secrets et opt-in explicites', () => {
    const env = { ...readConfig('wrangler.staging.jsonc').vars,
      BILLING_ENABLED: 'true', STRIPE_SECRET_KEY: 'sk_test_fixture',
      STRIPE_WEBHOOK_SECRET: 'whsec_fixture' };
    const gate = billingGate(env);
    expect(gate.enabled).toBe(true);
    expect(paidPriceId('solo', gate)).toBe('price_1UaAGVCZ5rRirUf6Mwl2S9LU');
    expect(paidPriceId('pro', gate)).toBe('price_1UaAGXCZ5rRirUf6yL7FJqSD');
    expect(paidPriceId('studio', gate)).toBe('price_1UaAGZCZ5rRirUf63iKoncrM');
    expect(billingGate({...env, STRIPE_SECRET_KEY: 'sk_live_forbidden'}).enabled).toBe(false);
  });
  it('ne copie ni Stripe ni les références staging dans le Worker production', () => {
    const production = readConfig('wrangler.jsonc');
    expect(production.name).toBe('mentioncheck');
    expect(Object.keys(production.vars).some(key => key.startsWith('STRIPE_'))).toBe(false);
    expect(JSON.stringify(production)).not.toContain('price_1UaAGVCZ5rRirUf6Mwl2S9LU');
    // La Preview QA du Worker production possède volontairement des références STAGING.
    // Seuls les bindings runtime production doivent en être isolés.
    expect(production.previews?.vars?.BILLING_ENABLED).toBe('false');
    expect(Object.keys(production.previews?.vars ?? {}).some(key => key.startsWith('STRIPE_PRICE_'))).toBe(false);
  });
});

it('limite le déploiement Stripe automatique à la branche dédiée et au Worker staging',()=>{
  const workflow=readFileSync(resolve(process.cwd(),'.github/workflows/stripe-sandbox-staging.yml'),'utf8');
  expect(workflow).toContain('branches: [feat/stripe-sandbox-mentioncheck-20261110]');
  expect(workflow).toContain("github.ref == 'refs/heads/feat/stripe-sandbox-mentioncheck-20261110'");
  expect(workflow).toContain('npx @opennextjs/cloudflare deploy --config wrangler.staging.jsonc -- --keep-vars');
  expect(workflow).toContain("BILLING_ENABLED: 'false'");
  expect(workflow).toContain("OPENAI_PAUSED: 'true'");
  expect(workflow).not.toContain('pull_request_target:');
  expect(workflow).not.toContain('wrangler.jsonc --');
});
