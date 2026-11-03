// Chemin : lib/security/rate-limit.ts
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { HttpError } from '@/lib/security/auth';

type Limiter = { limit(input: { key: string }): Promise<{ success: boolean }> };
type Limits = { API_SOLO_LIMITER?: Limiter; API_PAID_LIMITER?: Limiter };

// En production, Cloudflare impose un plafond local ; les quotas transactionnels
// Supabase font autorité pour les limites de facturation.
export async function checkRateLimit(userId: string, plan: string) {
  if (process.env.NODE_ENV !== 'production') return;
  const context = await getCloudflareContext();
  const env = context.env as unknown as Limits;
  const limiter = plan === 'solo' ? env.API_SOLO_LIMITER : env.API_PAID_LIMITER;
  if (!limiter) throw new HttpError(503, 'Protection contre les abus indisponible.');
  const { success } = await limiter.limit({ key: userId });
  if (!success) throw new HttpError(429, 'Trop de requêtes. Réessaie plus tard.');
}
