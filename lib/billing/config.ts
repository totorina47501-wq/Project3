// Paiements réels refusés jusqu'à un feu vert légal, fiscal et E2E explicite.
// Aucun secret Stripe côté client ; ces attestations serveur ne remplacent pas une revue humaine.
export type PaidPlan = 'solo' | 'pro' | 'studio';
export type BillingMode = 'test' | 'live';
export type StripeGate = {
  enabled:boolean; mode:BillingMode|null; reason:string;
  priceSolo?:string|undefined; pricePro?:string|undefined; priceStudio?:string|undefined;
};
type BillingEnv = {
  [name:string]:string|undefined;
  BILLING_ENABLED?:string;
  STRIPE_WEBHOOK_ENABLED?:string;
  STRIPE_MODE?:string;
  STRIPE_SECRET_KEY?:string;
  STRIPE_WEBHOOK_SECRET?:string;
  STRIPE_PRICE_SOLO?:string;
  STRIPE_PRICE_PRO?:string;
  STRIPE_PRICE_STUDIO?:string;
  // Prérequis stricts pour la production commerciale (absents du dépôt et de Cloudflare).
  STRIPE_LIVE_APPROVED?:string;
  STRIPE_LIVE_LEGAL_REGISTRATION?:string;
  STRIPE_LIVE_TAX_REVIEW?:string;
  STRIPE_LIVE_TERMS_REVIEW?:string;
  STRIPE_LIVE_E2E_REVIEW?:string;
  OPENAI_PAUSED?:string;
  OPENAI_TEXT_ENABLED?:string;
  OPENAI_VISION_ENABLED?:string;
  OPENAI_API_KEY?:string;
  NEXT_PUBLIC_APP_URL?:string;
};
const disabled = (reason:string):StripeGate => ({enabled:false,mode:null,reason});
export function billingGate(env:BillingEnv, purpose:'checkout'|'webhook'='checkout'):StripeGate {
  const authorized = purpose==='webhook'
    ? (env.STRIPE_WEBHOOK_ENABLED==='true' || env.BILLING_ENABLED==='true')
    : env.BILLING_ENABLED==='true';
  if(!authorized) return disabled('Paiements désactivés : lancement commercial non autorisé.');
  let mode:BillingMode;
  if(env.STRIPE_MODE==='test' && /^(?:sk|rk)_test_[A-Za-z0-9_]+$/.test(env.STRIPE_SECRET_KEY ?? '')) {
    mode='test';
  } else if(env.STRIPE_MODE==='live' && /^(?:sk|rk)_live_[A-Za-z0-9_]+$/.test(env.STRIPE_SECRET_KEY ?? '')) {
    // Un SIREN (9 chiffres) ou un SIRET (14 chiffres) vérifié est exigé pour le lancement FR.
    if(env.STRIPE_LIVE_APPROVED!=='true' ||
       !/^(?:[0-9]{9}|[0-9]{14})$/.test(env.STRIPE_LIVE_LEGAL_REGISTRATION??'') ||
       env.STRIPE_LIVE_TAX_REVIEW!=='approved' ||
       env.STRIPE_LIVE_TERMS_REVIEW!=='approved' ||
       env.STRIPE_LIVE_E2E_REVIEW!=='passed' ||
       // Ne pas commercialiser des analyses et réécritures IA indisponibles.
       env.OPENAI_PAUSED!=='false' ||
       env.OPENAI_TEXT_ENABLED!=='true' ||
       env.OPENAI_VISION_ENABLED!=='true' ||
       !env.OPENAI_API_KEY?.trim() ||
       env.NEXT_PUBLIC_APP_URL!=='https://mentioncheck.toto-rina47501.workers.dev') {
      return disabled('Lancement commercial non validé (identité, fiscalité, CGV, recette ou services IA).');
    }
    mode='live';
  } else {
    return disabled('Clé Stripe ou environnement incompatible.');
  }
  if(!env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_'))
    return disabled('Signature de webhook Stripe manquante.');
  const prices=[env.STRIPE_PRICE_SOLO,env.STRIPE_PRICE_PRO,env.STRIPE_PRICE_STUDIO];
  if(prices.some(p=>!/^price_[A-Za-z0-9]+$/.test(p??'')))
    return disabled('Trois prix Stripe distincts sont requis.');
  if(new Set(prices).size!==3) return disabled('Les offres doivent avoir des tarifs distincts.');
  return {enabled:true,mode,reason:mode==='test'?'Stripe Sandbox uniquement.':'Stripe live : contrôles préalables attestés.',
    priceSolo:env.STRIPE_PRICE_SOLO,pricePro:env.STRIPE_PRICE_PRO,priceStudio:env.STRIPE_PRICE_STUDIO};
}
export function paidPriceId(plan:PaidPlan,gate:StripeGate):string {
  if(!gate.enabled)throw new Error('Stripe désactivé.');
  const prices={solo:gate.priceSolo,pro:gate.pricePro,studio:gate.priceStudio};
  if(!Object.hasOwn(prices,plan))throw new Error('Offre Stripe inconnue.');
  const price=prices[plan];
  if(!price)throw new Error('Prix Stripe absent.');
  return price;
}
export function isBillableStatus(status:string):boolean {
  return status==='active'||status==='trialing';
}
