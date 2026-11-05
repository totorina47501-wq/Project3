// Traduction contrôlée des offres et statuts Stripe en droits applicatifs.
import type { PaidPlan } from './config';
import { isBillableStatus } from './config';

export function paidPlanFromPrices(priceIds: string[], config: {
  solo?: string | undefined; pro?: string | undefined; studio?: string | undefined;
}): PaidPlan | null {
  const match = new Set(priceIds);
  if (match.size !== 1) return null;
  const matched = (['solo','pro','studio'] as const).filter(plan => config[plan] && match.has(config[plan]!));
  return matched.length === 1 ? matched[0]! : null;
}
export function effectivePlan(status: string, paidPlan: PaidPlan | null):
  'solo' | PaidPlan {
  return paidPlan && isBillableStatus(status) ? paidPlan : 'solo';
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
