import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  stripe: vi.fn(),
  construct: vi.fn(),
  retrieve: vi.fn(),
  retrieveInvoice: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('../../lib/supabase/admin', () => ({ createAdminSupabase: mocks.admin }));
vi.mock('../../lib/billing/stripe', () => ({ getStripe: mocks.stripe }));
import { POST } from '../../app/api/stripe/webhook/route';

type Mutation = { table: string; values: Record<string, unknown>; filters: [string, unknown][] };
let writes: Mutation[];
let currentSubscription: string | null;
let currentReadError: boolean;
let conditionalMiss: boolean;
let receiptStatus: string | null;
const source = (id = 'sub_current', options: { status?: string } = {}) => ({
  created:1_700_000_000,id, customer: 'cus_owner', status: options.status ?? 'active',
  items: { data: [{ price: { id: 'price_STUDIO' }, current_period_end: 1_800_000_000 }] },
});
const request = () => new Request('https://local.test/api/stripe/webhook', {
  method: 'POST', headers: { 'stripe-signature': 'fixture-signature' }, body: '{}',
});

function database() {
  return { rpc:async (_name:string,values:Record<string,unknown>)=>{if(currentReadError)return {data:null,error:{message:'private database error'}}; if(conditionalMiss||values.p_subscription!==currentSubscription)return {data:false,error:null};writes.push({table:'atomic_rpc',values,filters:[]});return {data:true,error:null};},from(table: string) {
    let operation = 'select';
    let values: Record<string, unknown> = {};
    const filters: [string, unknown][] = [];
    const result = () => {
      if (operation !== 'select') writes.push({ table, values, filters });
      if (table === 'users') return { data: { id: 'owner' }, error: null };
      if (table === 'stripe_webhook_events') return { data: receiptStatus ? { status: receiptStatus } : null, error: null };
      if (table === 'subscriptions') {
        if (operation === 'select') return { data: currentSubscription ? { stripe_subscription_id: currentSubscription } : null, error: currentReadError ? { message: 'private database error' } : null };
        return { data: conditionalMiss ? null : { stripe_subscription_id: currentSubscription }, error: null };
      }
      throw new Error('Table de test inconnue.');
    };
    const chain = {
      select: () => chain,
      eq: (key: string, value: unknown) => { filters.push([key, value]); return chain; },
      insert: (input: Record<string, unknown>) => { operation = 'insert'; values = input; return chain; },
      update: (input: Record<string, unknown>) => { operation = 'update'; values = input; return chain; },
      upsert: (input: Record<string, unknown>) => { operation = 'upsert'; values = input; return chain; },
      maybeSingle: async () => result(),
      then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
    };
    return chain;
  } };
}
beforeEach(() => {
  vi.clearAllMocks(); writes = []; currentSubscription = 'sub_current'; currentReadError = false; conditionalMiss = false; receiptStatus = null;
  for (const [key, value] of Object.entries({ BILLING_ENABLED: 'true', STRIPE_MODE: 'test', STRIPE_SECRET_KEY: 'sk_test_fixture', STRIPE_WEBHOOK_SECRET: 'whsec_fixture', STRIPE_PRICE_SOLO: 'price_SOLO', STRIPE_PRICE_PRO: 'price_PRO', STRIPE_PRICE_STUDIO: 'price_STUDIO' })) vi.stubEnv(key, value);
  mocks.admin.mockImplementation(database);
  mocks.construct.mockReturnValue({ created:1_700_000_010,id: 'evt_fixture', livemode: false, type: 'customer.subscription.updated', data: { object: source() } });
  mocks.retrieve.mockResolvedValue(source());
  mocks.retrieveInvoice.mockResolvedValue({ subscription: 'sub_current' });
  mocks.stripe.mockReturnValue({
    webhooks: { constructEvent: mocks.construct },
    subscriptions: { retrieve: mocks.retrieve },
    invoices: { retrieve: mocks.retrieveInvoice },
  });
});
afterEach(() => vi.unstubAllEnvs());

describe('Webhooks Stripe isolés du fournisseur', () => {
  it('ignore la suppression d’une ancienne souscription après le remplacement par une nouvelle', async () => {
    mocks.construct.mockReturnValue({ created:1_700_000_010,id: 'evt_old', livemode: false, type: 'customer.subscription.deleted', data: { object: { ...source('sub_old'), status: 'canceled' } } });
    expect((await POST(request())).status).toBe(200);
    expect(writes.filter(write => write.table === 'subscriptions' || write.table === 'users')).toEqual([]);
    expect(mocks.retrieve).not.toHaveBeenCalled();
  });
  it('rétrograde uniquement la souscription supprimée encore rattachée au compte', async () => {
    mocks.construct.mockReturnValue({ created:1_700_000_010,id: 'evt_delete', livemode: false, type: 'customer.subscription.deleted', data: { object: source() } });
    expect((await POST(request())).status).toBe(200);
    expect(writes.find(write => write.table === 'atomic_rpc')).toMatchObject({values:{p_subscription:'sub_current',p_status:'canceled'}});
    expect(writes.filter(write=>write.table==='users'||write.table==='subscriptions')).toEqual([]);
  });
  it('n’altère pas les droits si une mise à jour concurrente a changé le rattachement', async () => {
    conditionalMiss = true;
    mocks.construct.mockReturnValue({ created:1_700_000_010,id: 'evt_race', livemode: false, type: 'customer.subscription.deleted', data: { object: source() } });
    expect((await POST(request())).status).toBe(200);
    expect(writes.filter(write => write.table === 'users')).toEqual([]);
  });
  it('enregistre la période des items en relisant l’état fournisseur actuel', async () => {
    expect((await POST(request())).status).toBe(200);
    expect(mocks.retrieve).toHaveBeenCalledWith('sub_current');
    expect(writes.find(write => write.table === 'atomic_rpc')).toMatchObject({ values: { p_period_end: new Date(1_800_000_000_000).toISOString(), p_plan: 'studio' } });
  });
  it('synchronise aussi un invoice.payment_failed pour révoquer les droits dès l’échec', async () => {
    mocks.construct.mockReturnValue({ created:1_700_000_010,id: 'evt_invoice_failed', livemode: false, type: 'invoice.payment_failed', data: { object: { subscription: 'sub_current' } } });
    mocks.retrieve.mockResolvedValue(source('sub_current', { status: 'past_due' }));
    expect((await POST(request())).status).toBe(200);
    expect(mocks.retrieve).toHaveBeenCalledWith('sub_current');
    expect(writes.find(write => write.table === 'atomic_rpc')).toMatchObject({ values: { p_subscription: 'sub_current', p_status: 'past_due' } });
  });
  it('synchronise un invoice.paid depuis la souscription relue et ignore une facture sans souscription', async () => {
    mocks.construct.mockReturnValue({ created:1_700_000_010,id: 'evt_invoice_paid', livemode: false, type: 'invoice.paid', data: { object: { subscription: 'sub_current' } } });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.retrieve).toHaveBeenCalledWith('sub_current');
    mocks.construct.mockReturnValue({ created:1_700_000_011,id: 'evt_invoice_without_subscription', livemode: false, type: 'invoice.paid', data: { object: { subscription: null } } });
    expect((await POST(request())).status).toBe(200);
  });
  it('lit la souscription au format Stripe Basil, y compris un objet expanded', async () => {
    mocks.construct.mockReturnValue({ created:1_700_000_010,id:'evt_basil_paid', livemode:false,
      type:'invoice.paid', data:{object:{parent:{type:'subscription_details',subscription_details:{subscription:'sub_current'}}}} });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.retrieve).toHaveBeenCalledWith('sub_current');
    mocks.retrieve.mockClear();
    mocks.construct.mockReturnValue({ created:1_700_000_011,id:'evt_basil_failed', livemode:false,
      type:'invoice.payment_failed', data:{object:{parent:{type:'subscription_details',subscription_details:{subscription:{id:'sub_current'}}}}} });
    mocks.retrieve.mockResolvedValue(source('sub_current',{status:'past_due'}));
    expect((await POST(request())).status).toBe(200);
    expect(mocks.retrieve).toHaveBeenCalledWith('sub_current');
    expect(writes.find(write => write.table==='atomic_rpc' && write.values.p_status==='past_due')).toBeDefined();
  });
  it('préfère la souscription sous parent pour une facture moderne à champ historique divergent', async () => {
    mocks.construct.mockReturnValue({ created:1_700_000_010,id:'evt_basil_priority',livemode:false,
      type:'invoice.paid',data:{object:{subscription:'sub_old',parent:{subscription_details:{subscription:'sub_current'}}}} });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.retrieve).toHaveBeenCalledWith('sub_current');
    expect(mocks.retrieve).not.toHaveBeenCalledWith('sub_old');
  });
  it('synchronise checkout.session.completed seulement en mode subscription', async () => {
    mocks.construct.mockReturnValue({ created:1_700_000_010,id: 'evt_checkout_subscription', livemode: false, type: 'checkout.session.completed', data: { object: { mode: 'subscription', subscription: 'sub_current' } } });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.retrieve).toHaveBeenCalledWith('sub_current');
    mocks.retrieve.mockClear();
    mocks.construct.mockReturnValue({ created:1_700_000_011,id: 'evt_checkout_payment', livemode: false, type: 'checkout.session.completed', data: { object: { mode: 'payment', subscription: null } } });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.retrieve).not.toHaveBeenCalled();
  });
  it('synchronise payment_intent.payment_failed via invoice puis souscription, et ignore sans facture', async () => {
    mocks.construct.mockReturnValue({ created:1_700_000_010,id: 'evt_pi_failed', livemode: false, type: 'payment_intent.payment_failed', data: { object: { invoice: 'in_failed' } } });
    mocks.retrieveInvoice.mockResolvedValue({ parent: { type: 'subscription_details', subscription_details: { subscription: 'sub_current' } } });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.retrieveInvoice).toHaveBeenCalledWith('in_failed');
    expect(mocks.retrieve).toHaveBeenCalledWith('sub_current');
    mocks.retrieveInvoice.mockClear();
    mocks.retrieve.mockClear();
    mocks.construct.mockReturnValue({ created:1_700_000_011,id: 'evt_pi_without_invoice', livemode: false, type: 'payment_intent.payment_failed', data: { object: { invoice: null } } });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.retrieveInvoice).not.toHaveBeenCalled();
    expect(mocks.retrieve).not.toHaveBeenCalled();
  });
  it('échoue sans rétrogradation si la correspondance persistante ne peut pas être lue', async () => {
    currentReadError = true;
    mocks.construct.mockReturnValue({ created:1_700_000_010,id: 'evt_failure', livemode: false, type: 'customer.subscription.deleted', data: { object: source() } });
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(writes.filter(write => write.table === 'users' || write.table === 'subscriptions')).toEqual([]);
    expect(JSON.stringify(await response.json())).not.toContain('private database error');
  });
  it('refuse un événement live avant toute mutation même en mode test', async () => {
    mocks.construct.mockReturnValue({ created:1_700_000_010,id: 'evt_live', livemode: true, type: 'customer.subscription.updated', data: { object: source() } });
    expect((await POST(request())).status).toBe(400);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it('ne réexécute pas un reçu déjà traité et ne contacte aucun fournisseur sans activation', async () => {
    receiptStatus = 'processed';
    expect((await POST(request())).status).toBe(200);
    expect(mocks.retrieve).not.toHaveBeenCalled();
    expect(writes).toEqual([]);
    vi.stubEnv('BILLING_ENABLED', 'false');
    mocks.stripe.mockClear();
    expect((await POST(request())).status).toBe(503);
    expect(mocks.stripe).not.toHaveBeenCalled();
  });
});
it('refuse un événement test lorsque les prérequis live sont attestés', async()=>{
  for(const [name,value] of Object.entries({
    STRIPE_MODE:'live',STRIPE_SECRET_KEY:'sk_live_fixture',
    STRIPE_LIVE_APPROVED:'true',STRIPE_LIVE_LEGAL_REGISTRATION:'123456789',
    STRIPE_LIVE_TAX_REVIEW:'approved',STRIPE_LIVE_TERMS_REVIEW:'approved',
    STRIPE_LIVE_E2E_REVIEW:'passed',
    OPENAI_PAUSED:'false',OPENAI_TEXT_ENABLED:'true',OPENAI_VISION_ENABLED:'true',OPENAI_API_KEY:'sk-proj-fixture',
    NEXT_PUBLIC_APP_URL:'https://mentioncheck.app'
  }))vi.stubEnv(name,value);
  const response=await POST(request());
  expect(response.status).toBe(400);
  expect(mocks.admin).not.toHaveBeenCalled();
});

it('accepte un événement Sandbox signé avec le Checkout coupé et le webhook ouvert',async()=>{
  vi.stubEnv('BILLING_ENABLED','false');
  vi.stubEnv('STRIPE_WEBHOOK_ENABLED','true');
  const response=await POST(request());
  expect(response.status).toBe(200);
  expect(mocks.construct).toHaveBeenCalledTimes(1);
  expect(writes.find(x=>x.table==='atomic_rpc')).toMatchObject({values:{p_subscription:'sub_current'}});
});
