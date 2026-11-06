import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ admin: vi.fn(), stripe: vi.fn(), construct: vi.fn(), retrieve: vi.fn() }));
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
const source = (id = 'sub_current') => ({
  created:1_700_000_000,id, customer: 'cus_owner', status: 'active',
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
  mocks.stripe.mockReturnValue({ webhooks: { constructEvent: mocks.construct }, subscriptions: { retrieve: mocks.retrieve } });
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
