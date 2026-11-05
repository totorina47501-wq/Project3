// Stripe ne peut démarrer qu'en mode test ET après activation explicite.
export type PaidPlan = 'solo' | 'pro' | 'studio';
export type StripeGate = {
  enabled: boolean;
  reason: string;
  priceSolo?: string | undefined;
  pricePro?: string | undefined;
  priceStudio?: string | undefined;
};
type BillingEnv = {
  [name: string]: string | undefined;
  BILLING_ENABLED?: string | undefined;
  STRIPE_MODE?: string | undefined;
  STRIPE_SECRET_KEY?: string | undefined;
  STRIPE_WEBHOOK_SECRET?: string | undefined;
  STRIPE_PRICE_SOLO?: string | undefined;
  STRIPE_PRICE_PRO?: string | undefined;
  STRIPE_PRICE_STUDIO?: string | undefined;
};
export function billingGate(env: BillingEnv): StripeGate {
  if (env.BILLING_ENABLED !== 'true') return {
    enabled: false, reason: 'Paiements désactivés : lancement commercial non autorisé.',
  };
  if (env.STRIPE_MODE !== 'test' || !env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
    return { enabled: false, reason: 'Seul Stripe en mode test est autorisé.' };
  }
  if (!env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_')) {
    return { enabled: false, reason: 'Signature de webhook Stripe manquante.' };
  }
  if (!/^price_[A-Za-z0-9]+$/.test(env.STRIPE_PRICE_PRO ?? '') ||
      !/^price_[A-Za-z0-9]+$/.test(env.STRIPE_PRICE_STUDIO ?? '')) {
    return { enabled: false, reason: 'Prix Stripe de test non configurés.' };
  }
  if (env.STRIPE_PRICE_SOLO && !/^price_[A-Za-z0-9]+$/.test(env.STRIPE_PRICE_SOLO))
    return { enabled: false, reason: 'Prix Solo de test invalide.' };
  const prices = [env.STRIPE_PRICE_SOLO, env.STRIPE_PRICE_PRO, env.STRIPE_PRICE_STUDIO].filter(Boolean);
  if (new Set(prices).size !== prices.length)
    return { enabled: false, reason: 'Les offres doivent utiliser des tarifs Stripe distincts.' };
  return { enabled: true, reason: 'Stripe test seulement.',
    priceSolo: env.STRIPE_PRICE_SOLO, pricePro: env.STRIPE_PRICE_PRO, priceStudio: env.STRIPE_PRICE_STUDIO };
}
export function paidPriceId(plan: PaidPlan, gate: StripeGate): string {
  if (!gate.enabled) throw new Error('Stripe désactivé.');
  const prices = { solo: gate.priceSolo, pro: gate.pricePro, studio: gate.priceStudio };
  if (!Object.hasOwn(prices, plan)) throw new Error('Offre Stripe inconnue.');
  const price = prices[plan];
  if (!price) throw new Error('Prix Stripe absent.');
  return price;
}
export function isBillableStatus(status: string): boolean {
  return status === 'active' || status === 'trialing';
}
