import { BRAND } from '@/lib/branding';
export type AccountPlan='solo'|'pro'|'studio';
// Le statut gratuit n'est PAS un abonnement Stripe ni une valeur de l'enum Postgres.
export type AccessTier='free'|AccountPlan;
export type PlanQuota='check'|'rewrite'|'mia';
export type PlanEntitlements={
  plan:AccessTier;checksMonthly:number;rewritesMonthly:number;miaMonthly:number;
  socialAccounts:number|null;studioSeats:number;studioApi:boolean;
};
const entitlements:Record<AccessTier,Readonly<PlanEntitlements>>={
  free:Object.freeze({plan:'free',checksMonthly:3,rewritesMonthly:1,miaMonthly:3,socialAccounts:3,studioSeats:0,studioApi:false}),
  solo:Object.freeze({plan:'solo',checksMonthly:30,rewritesMonthly:5,miaMonthly:20,socialAccounts:3,studioSeats:0,studioApi:false}),
  pro:Object.freeze({plan:'pro',checksMonthly:500,rewritesMonthly:500,miaMonthly:300,socialAccounts:null,studioSeats:0,studioApi:false}),
  studio:Object.freeze({plan:'studio',checksMonthly:2000,rewritesMonthly:2000,miaMonthly:1500,socialAccounts:null,studioSeats:5,studioApi:true}),
};
export function planEntitlements(plan:AccessTier):PlanEntitlements {
  if(!Object.hasOwn(entitlements,plan))throw new Error('Offre inconnue.');
  return {...entitlements[plan]};
}
export function remainingPlanQuota(plan:AccessTier,action:PlanQuota,used:number):number {
  if(!Number.isSafeInteger(used)||used<0)throw new Error('Usage invalide.');
  const limits=planEntitlements(plan);
  const limit=action==='check'?limits.checksMonthly:action==='rewrite'?limits.rewritesMonthly:action==='mia'?limits.miaMonthly:null;
  if(limit===null)throw new Error('Quota inconnu.');
  return Math.max(0,limit-used);
}
// Prix publics indicatifs. Une simulation ne facture rien et ne calcule pas de TVA/prorata.
export function simulatedPlanQuote(plan:AccountPlan){
  planEntitlements(plan);
  return {plan,currency:'EUR' as const,monthlyPriceCents:BRAND.plans[plan].priceMonthlyEur*100,
    chargedCents:0 as const,commercial:false as const,mode:'local-simulation' as const};
}
