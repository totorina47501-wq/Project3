// Chemin : lib/security/quota.ts
import { createAdminSupabase } from '@/lib/supabase/admin';
import { HttpError } from '@/lib/security/auth';

export type QuotaAction = 'check' | 'rewrite' | 'mia';

export async function consumeQuota(userId: string, action: QuotaAction) {
  const { data, error } = await createAdminSupabase()
    .rpc('reserve_usage_quota', { p_user_id: userId, p_action: action });
  if (error) throw new HttpError(503, 'Quotas non configurés dans Supabase.');
  if (data === null || data === false) throw new HttpError(429, 'Ton quota mensuel est atteint.');
  if (typeof data !== 'string' || !/^\d{4}-\d{2}-01$/.test(data))
    throw new HttpError(503, 'Période de quota indisponible.');
  return data;
}

export async function refundQuota(userId: string, action: QuotaAction, periodStart: string) {
  const { error } = await createAdminSupabase()
    .rpc('refund_usage_quota', { p_user_id: userId, p_action: action, p_period_start: periodStart });
  if (error) {
    console.error('[mentioncheck][quota_refund_failed]', { action });
  }
}
