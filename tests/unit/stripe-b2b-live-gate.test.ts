import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ user: vi.fn(), admin: vi.fn(), stripe: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('../../lib/security/auth', async original => ({
  ...await original<typeof import('../../lib/security/auth')>(), requireUser: mocks.user,
}));
vi.mock('../../lib/supabase/admin', () => ({ createAdminSupabase: mocks.admin }));
vi.mock('../../lib/billing/stripe', () => ({ getStripe: mocks.stripe }));
import { POST } from '../../app/api/stripe/checkout/route';

const business = {
  verified: true, country: 'FR', purchase_purpose: 'core_professional_activity',
  reviewed_by: 'operator', legal_name: 'Entreprise Fixture',
  registration_id: '123456789', reviewed_at: new Date(Date.now() - 86_400_000).toISOString(),
};
const request = () => new Request('https://mentioncheck.app/api/stripe/checkout', {
  method: 'POST',
  headers: { origin: 'https://mentioncheck.app', 'content-type': 'application/json' },
  body: JSON.stringify({plan:'solo'}),
});

beforeEach(() => {
  vi.clearAllMocks();
  for (const [key,value] of Object.entries({
    BILLING_ENABLED:'true', STRIPE_MODE:'live',
    STRIPE_SECRET_KEY:'sk_live_fixture', STRIPE_WEBHOOK_SECRET:'whsec_fixture',
    STRIPE_PRICE_SOLO:'price_SOLO', STRIPE_PRICE_PRO:'price_PRO', STRIPE_PRICE_STUDIO:'price_STUDIO',
    STRIPE_LIVE_APPROVED:'true', STRIPE_LIVE_LEGAL_REGISTRATION:'123456789',
    STRIPE_LIVE_TAX_REVIEW:'approved', STRIPE_LIVE_TERMS_REVIEW:'approved',
    STRIPE_LIVE_E2E_REVIEW:'passed', OPENAI_PAUSED:'false',
    OPENAI_TEXT_ENABLED:'true', OPENAI_VISION_ENABLED:'true',
    OPENAI_API_KEY:'sk-proj-fixture', NEXT_PUBLIC_APP_URL:'https://mentioncheck.app',
  })) vi.stubEnv(key,value);
  mocks.user.mockResolvedValue({ user: {id:'fixture-user',email:'fixture@example.test'} });
  mocks.admin.mockImplementation(() => { throw Error('TEST ONLY: stop before any provider access'); });
});

afterEach(() => vi.unstubAllEnvs());

it('refuse tout Checkout Live sans portée de clientèle explicite avant authentification', async () => {
  const response=await POST(request());
  expect(response.status).toBe(503);
  expect(mocks.user).not.toHaveBeenCalled();
  expect(mocks.admin).not.toHaveBeenCalled();
  expect(mocks.stripe).not.toHaveBeenCalled();
});

it('la portée general_public accepte un compte particulier authentifié sans vérifier une entreprise', async () => {
  vi.stubEnv('STRIPE_LIVE_BUYER_SCOPE','general_public');
  mocks.user.mockResolvedValue({user:{id:'consumer-fixture',email:'consumer@example.test',app_metadata:{}}});
  const response=await POST(request());
  // Un stub stoppe la suite après le contrôle d'accès, avant toute opération Stripe.
  expect(response.status).toBe(503);
  expect(mocks.user).toHaveBeenCalledTimes(1);
  expect(mocks.admin).toHaveBeenCalledTimes(1);
  expect(mocks.stripe).not.toHaveBeenCalled();
});

it('refuse les comptes B2C et les données que le client peut s’attribuer', async () => {
  vi.stubEnv('STRIPE_LIVE_BUYER_SCOPE','verified_b2b_fr');
  mocks.user.mockResolvedValue({user:{
    id:'fixture-user',email:'fixture@example.test',
    user_metadata:{mentioncheck_b2b:business},app_metadata:{},
  }});
  const response=await POST(request());
  expect(response.status).toBe(403);
  expect(mocks.admin).not.toHaveBeenCalled();
  expect(mocks.stripe).not.toHaveBeenCalled();
});

it('un compte vérifié peut franchir le filtre B2B, sans déclencher de charge fournisseur', async () => {
  vi.stubEnv('STRIPE_LIVE_BUYER_SCOPE','verified_b2b_fr');
  mocks.user.mockResolvedValue({user:{
    id:'fixture-user',email:'fixture@example.test',app_metadata:{mentioncheck_b2b:business},
  }});
  const response=await POST(request());
  // La fixture stoppe VOLONTAIREMENT l'opération après le contrôle B2B.
  expect(response.status).toBe(503);
  expect(mocks.admin).toHaveBeenCalledTimes(1);
  expect(mocks.stripe).not.toHaveBeenCalled();
});
