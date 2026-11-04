import { describe, expect, it } from 'vitest';
import { planEntitlements, remainingPlanQuota, simulatedPlanQuote } from '../../lib/billing/plans';
import { createBillingSimulation } from '../../lib/billing/simulation';
const prices={pro:'price_PRO',studio:'price_STUDIO'};
const event=(id:string,created:number,price='price_PRO',status='active',subscriptionId='sub_one')=>({id,created,type:'customer.subscription.updated' as const,customerId:'cus_local',subscriptionId,status,priceIds:[price]});
describe('Abonnements simulés et droits des trois offres',()=>{
  it('simule aussi une souscription Solo sans modifier le checkout réel',()=>{
    const simulation=createBillingSimulation({accountId:'owner',customerId:'cus_local',prices:{...prices,solo:'price_SOLO'}});
    const result=simulation.apply(event('evt_solo',1,'price_SOLO'));
    expect(result.state.subscribedPlan).toBe('solo'); expect(result.state.chargedCents).toBe(0);
    expect(()=>simulation.apply({...event('evt_mix_solo',2),priceIds:['price_SOLO','price_PRO']})).toThrow();
    expect(simulation.snapshot().plan).toBe('solo');
  });
  it('reprend prix indicatifs et quotas existants, sans charge réelle',()=>{
    expect(['solo','pro','studio'].map(p=>simulatedPlanQuote(p as 'solo'|'pro'|'studio').monthlyPriceCents)).toEqual([900,1900,4900]);
    expect(planEntitlements('solo')).toMatchObject({checksMonthly:30,rewritesMonthly:5,miaMonthly:20,socialAccounts:3,studioApi:false,studioSeats:0});
    expect(planEntitlements('pro')).toMatchObject({checksMonthly:500,rewritesMonthly:500,miaMonthly:300,studioApi:false});
    expect(planEntitlements('studio')).toMatchObject({checksMonthly:2000,rewritesMonthly:2000,miaMonthly:1500,studioApi:true,studioSeats:5});
    expect(simulatedPlanQuote('studio').chargedCents).toBe(0);
    expect(()=>planEntitlements('admin' as 'solo')).toThrow();
  });
  it('applique une seule fois, ignore le périmé et refuse une collision idempotente',()=>{
    const simulation=createBillingSimulation({accountId:'owner',customerId:'cus_local',prices});
    expect(simulation.apply(event('evt_new',20,'price_STUDIO')).outcome).toBe('applied');
    expect(simulation.apply(event('evt_new',20,'price_STUDIO')).outcome).toBe('duplicate');
    expect(simulation.apply(event('evt_old',10)).outcome).toBe('stale');
    expect(simulation.snapshot().plan).toBe('studio');
    expect(()=>simulation.apply(event('evt_new',20,'price_PRO'))).toThrow(/identifiant/i);
  });
  it('downgrade immédiat conserve les usages et révoque les droits Studio',()=>{
    const simulation=createBillingSimulation({accountId:'owner',customerId:'cus_local',prices,usage:{check:100,rewrite:8,mia:60}});
    simulation.apply(event('evt_first',10,'price_STUDIO'));
    const change=simulation.apply(event('evt_cancel',20,'price_STUDIO','canceled'));
    expect(change.state.plan).toBe('solo');expect(change.state.usage.check).toBe(100);
    expect(change.entitlements.studioApi).toBe(false);expect(remainingPlanQuota('solo','check',100)).toBe(0);
    expect(remainingPlanQuota('pro','check',100)).toBe(400);
  });
  it('ne ressuscite pas une souscription supprimée et ignore les égalités temporelles ambiguës',()=>{
    const simulation=createBillingSimulation({accountId:'owner',customerId:'cus_local',prices});
    simulation.apply(event('evt_active',10));
    expect(simulation.apply({...event('evt_deleted',20),type:'customer.subscription.deleted'}).state.plan).toBe('solo');
    expect(simulation.apply(event('evt_resurrect',21)).outcome).toBe('terminal');
    expect(simulation.apply(event('evt_new_sub',30,'price_STUDIO','active','sub_two')).state.plan).toBe('studio');
    expect(simulation.apply({...event('evt_old_delete',40),type:'customer.subscription.deleted'}).outcome).toBe('superseded');
    expect(simulation.apply(event('evt_equal',30,'price_PRO','active','sub_two')).outcome).toBe('ambiguous');
    expect(simulation.snapshot().plan).toBe('studio');
  });
  it('échoue sans mutation sur client inconnu, prix inconnu/ambigu ou événement live',()=>{
    const simulation=createBillingSimulation({accountId:'owner',customerId:'cus_local',prices});
    for(const incoming of [{...event('evt_wrong',1),customerId:'cus_other'},event('evt_price',1,'price_unknown'),{...event('evt_live',1),livemode:true},{...event('evt_mix',1),priceIds:['price_PRO','price_STUDIO']}])
      expect(()=>simulation.apply(incoming)).toThrow();
    expect(simulation.snapshot().plan).toBe('solo');
    expect(()=>createBillingSimulation({accountId:'owner',customerId:'cus_local',prices:{pro:'price_SAME',studio:'price_SAME'}})).toThrow();
  });
});
