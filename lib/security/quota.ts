// Chemin : lib/security/quota.ts
import { createAdminSupabase } from '@/lib/supabase/admin';
import { HttpError } from '@/lib/security/auth';

export async function consumeQuota(userId: string, action: 'check' | 'rewrite') {
  const { data, error } = await createAdminSupabase()
    .rpc('consume_usage_quota', { p_user_id: userId, p_action: action });
  if (error) throw new HttpError(503, 'Quotas non configurés dans Supabase.');
  if (!data) throw new HttpError(429, 'Ton quota mensuel est atteint.');
}

export async function refundQuota(userId: string, action: 'check' | 'rewrite') {
  const { error } = await createAdminSupabase()
    .rpc('refund_usage_quota', { p_user_id: userId, p_action: action });
  if (error) {
    // Les erreurs de remboursement doivent être traitées côté exploitation.
    console.error('Remboursement de quota impossible.');
  }
}
