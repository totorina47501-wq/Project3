import { z } from 'zod';
import { effectivePlan, paidPlanFromPrices, stripeStatus } from './events';
import { planEntitlements, type AccountPlan, type PlanQuota } from './plans';
const localId=z.string().regex(/^[A-Za-z0-9_:-]{1,128}$/);
const eventSchema=z.object({
  id:z.string().regex(/^evt_[A-Za-z0-9_]{1,100}$/),created:z.number().int().min(0).max(253402300799),
  type:z.enum(['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted']),
  customerId:z.string().regex(/^cus_[A-Za-z0-9_]{1,100}$/),subscriptionId:z.string().regex(/^sub_[A-Za-z0-9_]{1,100}$/),
  status:z.enum(['incomplete','incomplete_expired','trialing','active','past_due','canceled','unpaid','paused']),
  priceIds:z.array(z.string().regex(/^price_[A-Za-z0-9_]{1,100}$/)).min(1).max(10),
  livemode:z.literal(false).default(false),
}).strict();
export type SimulatedBillingEvent=z.input<typeof eventSchema>;
export type SimulatedBillingState={
  accountId:string;customerId:string;subscriptionId:string|null;status:ReturnType<typeof stripeStatus>|null;
  subscribedPlan:AccountPlan|null;plan:AccountPlan;lastEventCreated:number|null;
  usage:Record<PlanQuota,number>;chargedCents:0;
};
export type BillingSimulationOutcome='applied'|'duplicate'|'stale'|'terminal'|'superseded'|'ambiguous'|'conflict';
type Receipt={fingerprint:string;outcome:BillingSimulationOutcome};
export function createBillingSimulation(options:{accountId:string;customerId:string;prices:{solo?:string;pro:string;studio:string};usage?:Partial<Record<PlanQuota,number>>}){
  localId.parse(options.accountId);
  z.string().regex(/^cus_[A-Za-z0-9_]{1,100}$/).parse(options.customerId);
  const priceSchema=z.string().regex(/^price_[A-Za-z0-9_]{1,100}$/);
  priceSchema.parse(options.prices.pro);priceSchema.parse(options.prices.studio);
  if(options.prices.solo!==undefined)priceSchema.parse(options.prices.solo);
  if(new Set(Object.values(options.prices)).size!==Object.values(options.prices).length)throw new Error('Les offres doivent avoir des prix distincts.');
  const prices={...options.prices};
  const usage={check:0,rewrite:0,mia:0,...options.usage};
  for(const value of Object.values(usage))z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).parse(value);
  let state:SimulatedBillingState={accountId:options.accountId,customerId:options.customerId,subscriptionId:null,status:null,subscribedPlan:null,plan:'solo',lastEventCreated:null,usage,chargedCents:0};
  const receipts=new Map<string,Receipt>();const terminalSubscriptions=new Set<string>();
  const snapshot=():SimulatedBillingState=>structuredClone(state);
  function result(outcome:BillingSimulationOutcome){return {outcome,state:snapshot(),entitlements:planEntitlements(state.plan),mode:'local-simulation' as const};}
  function apply(input:unknown){
    const event=eventSchema.parse(input);
    if(event.customerId!==state.customerId)throw new Error('Client sans correspondance locale.');
    if(new Set(event.priceIds).size!==1)throw new Error('Prix de souscription ambigu.');
    const paidPlan=paidPlanFromPrices(event.priceIds,prices);
    if(!paidPlan)throw new Error('Prix de souscription inconnu ou ambigu.');
    const fingerprint=JSON.stringify(event);
    const receipt=receipts.get(event.id);
    if(receipt){
      if(receipt.fingerprint!==fingerprint)throw new Error('Collision d’identifiant événement.');
      return result('duplicate');
    }
    const record=(outcome:BillingSimulationOutcome)=>{receipts.set(event.id,{fingerprint,outcome});return result(outcome);};
    if(terminalSubscriptions.has(event.subscriptionId))return record(state.subscriptionId===event.subscriptionId?'terminal':'superseded');
    if(state.lastEventCreated!==null&&event.created<state.lastEventCreated)return record('stale');
    if(state.lastEventCreated===event.created&&event.type!=='customer.subscription.deleted')return record('ambiguous');
    if(state.subscriptionId&&state.subscriptionId!==event.subscriptionId&&state.status!=='canceled'&&state.status!=='incomplete_expired')return record('conflict');
    const status=event.type==='customer.subscription.deleted'?'canceled':stripeStatus(event.status);
    // Une seule affectation après validation : profil et droits locaux ne divergent pas.
    state={...state,subscriptionId:event.subscriptionId,status,subscribedPlan:paidPlan,plan:paidPlan==='solo'?'solo':effectivePlan(status,paidPlan),lastEventCreated:event.created};
    if(status==='canceled'||status==='incomplete_expired')terminalSubscriptions.add(event.subscriptionId);
    return record('applied');
  }
  return Object.freeze({apply,snapshot});
}
