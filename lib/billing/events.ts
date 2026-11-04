// Traduction contrôlée des offres et statuts Stripe en droits applicatifs.
import type { PaidPlan } from '@/lib/billing/config';
import { isBillableStatus } from '@/lib/billing/config';

export function paidPlanFromPrices(priceIds: string[], config: {
  pro?: string | undefined; studio?: string | undefined;
}): PaidPlan | null {
  const match = new Set(priceIds);
  if (match.size !== 1) return null;
  if (config.pro && match.has(config.pro)) return 'pro';
  if (config.studio && match.has(config.studio)) return 'studio';
  return null;
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
