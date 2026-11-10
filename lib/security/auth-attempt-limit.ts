// Compensation Supabase Free : limiter IP sur Workers avant Auth. Pas de PII dans la clé.
import { createHash } from 'node:crypto';
import { HttpError } from '@/lib/security/auth';
import { checkRateLimit } from '@/lib/security/rate-limit';
export async function requireAuthAttemptLimit(request:Request):Promise<void> {
  if(process.env.NODE_ENV!=='production')return;
  // En production, seul Cloudflare est autorisé à poser CF-Connecting-IP.
  // Ne jamais accepter x-forwarded-for envoyé par le visiteur.
  const ip=request.headers.get('cf-connecting-ip')?.trim();
  if(!ip || ip.length>45 || !/^[a-fA-F0-9:.]+$/.test(ip))
    throw new HttpError(503,'Protection de connexion indisponible.');
  const key='auth:'+createHash('sha256').update(ip).digest('hex');
  await checkRateLimit(key,'solo');
}
