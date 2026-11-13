// Traduction contrôlée des offres et statuts Stripe en droits applicatifs.
import type { PaidPlan } from './config';
import type { AccessTier } from './plans';
import { isBillableStatus } from './config';

export function paidPlanFromPrices(priceIds: string[], config: {
  solo?: string | undefined; pro?: string | undefined; studio?: string | undefined;
}): PaidPlan | null {
  const match = new Set(priceIds);
  if (match.size !== 1) return null;
  const matched = (['solo','pro','studio'] as const).filter(plan => config[plan] && match.has(config[plan]!));
  return matched.length === 1 ? matched[0]! : null;
}
export function effectivePlan(status: string, paidPlan: PaidPlan | null): AccessTier {
  return paidPlan && isBillableStatus(status) ? paidPlan : 'free';
}

// Un plan historique en base ne suffit pas à accorder les droits d'un abonnement.
// Les dates, le statut et la référence fournisseur doivent tous être valides.
export function subscriptionAccessTier(subscription: {
  stripe_subscription_id: string | null;
  plan: PaidPlan;
  status: string;
  current_period_end: string | null;
} | null, now = Date.now()): AccessTier {
  if (!subscription?.stripe_subscription_id || !isBillableStatus(subscription.status)) return 'free';
  const expiry = subscription.current_period_end ? Date.parse(subscription.current_period_end) : NaN;
  if (!Number.isFinite(expiry) || expiry <= now) return 'free';
  if (!['solo','pro','studio'].includes(subscription.plan)) return 'free';
  return subscription.plan;
}
// Une promotion Solo est indépendante du fournisseur ; aucun identifiant Stripe fictif.
export function accessTierWithPromotion(
  subscription: Parameters<typeof subscriptionAccessTier>[0],
  promotion: {starts_at:string|null;expires_at:string|null;activation_pending?:boolean;reason?:string}|null,
  now = Date.now(),
): AccessTier {
  const subscribed = subscriptionAccessTier(subscription,now);
  if (subscribed !== 'free') return subscribed;
  if (!promotion) return 'free';
  // SQL reconnaît exclusivement le pont Solo pré-GO sur les comptes historiques.
  // Aucun compteur de 30 jours ne commence tant que les dates sont nulles.
  if (promotion.activation_pending === true) {
    return promotion.reason === 'legacy_launch_solo_30d'
      && promotion.starts_at === null && promotion.expires_at === null
      ? 'solo' : 'free';
  }
  if (!promotion.starts_at || !promotion.expires_at) return 'free';
  const start=Date.parse(promotion.starts_at),end=Date.parse(promotion.expires_at);
  return Number.isFinite(start)&&Number.isFinite(end)&&end>start&&start<=now&&now<end
    ? 'solo' : 'free';
}
export function stripeStatus(status: string):
  'incomplete' | 'incomplete_expired' | 'trialing' | 'active' |
  'past_due' | 'canceled' | 'unpaid' | 'paused' {
  switch (status) {
    case 'incomplete': case 'incomplete_expired': case 'trialing':
    case 'active': case 'past_due': case 'canceled': case 'unpaid':
    case 'paused': return status;
    default: return 'incomplete';
  }
}

type SubscriptionPeriods = {
  current_period_end?: number;
  items?: { data: ReadonlyArray<{ current_period_end?: number }> };
};
// Les versions récentes de Stripe portent la période sur chaque item.
// Plusieurs périodes => échéance la plus proche ; ancien format en repli.
export function subscriptionPeriodEnd(subscription: SubscriptionPeriods): string | null {
  const items = subscription.items?.data ?? [];
  const periods = items.length
    ? items.map(item => item.current_period_end ?? subscription.current_period_end)
    : [subscription.current_period_end];
  if (!periods.every((value): value is number =>
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= 253402300799)) return null;
  return new Date(Math.min(...periods) * 1000).toISOString();
}
