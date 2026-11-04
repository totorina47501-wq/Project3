// Stripe ne peut démarrer qu'en mode test ET après activation explicite.
export type PaidPlan = 'pro' | 'studio';
export type StripeGate = {
  enabled: boolean;
  reason: string;
  pricePro?: string | undefined;
  priceStudio?: string | undefined;
};
type BillingEnv = {
  BILLING_ENABLED?: string | undefined;
  STRIPE_MODE?: string | undefined;
  STRIPE_SECRET_KEY?: string | undefined;
  STRIPE_WEBHOOK_SECRET?: string | undefined;
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
  return { enabled: true, reason: 'Stripe test seulement.',
    pricePro: env.STRIPE_PRICE_PRO, priceStudio: env.STRIPE_PRICE_STUDIO };
}
export function paidPriceId(plan: PaidPlan, gate: StripeGate): string {
  if (!gate.enabled) throw new Error('Stripe désactivé.');
  const price = plan === 'pro' ? gate.pricePro : gate.priceStudio;
  if (!price) throw new Error('Prix Stripe absent.');
  return price;
}
export function isBillableStatus(status: string): boolean {
  return status === 'active' || status === 'trialing';
}
