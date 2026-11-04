// File de préparation technique : aucun modèle IA ni exécuteur distant lancé ici.
import { z } from 'zod';
import { requireUser, publicError, HttpError } from '@/lib/security/auth';
import { isSameOrigin } from '@/lib/security/origin';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { readPrivacyJson } from '@/lib/privacy/request';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { platformSchema } from '@/lib/ai/schemas';
import { applyRules, riskFrom, levelFromRisk } from '@/lib/ai/rules';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const actions = z.discriminatedUnion('action', [
  z.object({ action: z.literal('enqueue'), assetIds: z.array(z.string().uuid()).min(1).max(5),
    caption: z.string().trim().min(1).max(10000), platform: platformSchema }).strict(),
  z.object({ action: z.literal('cancel'), jobId: z.string().uuid() }).strict(),
]);
function enabled() {
  if (process.env.MEDIA_PROCESSING_ENABLED !== 'true' || process.env.MEDIA_JOBS_SCHEMA_READY !== 'true')
    throw new HttpError(503, 'La préparation automatique des médias est désactivée.');
}
const respond = (body: unknown, status = 200) => Response.json(body, { status, headers: {
  'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
} });
function failure(error: unknown) {
  if (error instanceof SyntaxError) return respond({ error: 'JSON incorrect.' }, 400);
  const { status, message } = publicError(error);
  return respond({ error: message }, status);
}
export async function GET(request: Request) {
  try {
    const { user, client } = await requireUser(); enabled();
    const raw = new URL(request.url).searchParams;
    const parsed = z.coerce.number().int().min(0).max(10000).safeParse(raw.get('offset') ?? 0);
    if (!parsed.success) throw new HttpError(400, 'Pagination incorrecte.');
    const { data, error, count } = await client.from('media_processing_jobs')
      .select('id,verification_id,kind,status,attempts,failure_code,result,created_at,updated_at,completed_at', { count: 'exact' })
      .eq('user_id', user.id).order('created_at', { ascending: false }).order('id', { ascending: false })
      .range(parsed.data, parsed.data + 19);
    if (error) throw new Error('File indisponible.');
    return respond({ jobs: data ?? [], total: count ?? 0, offset: parsed.data, limit: 20 });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) throw new HttpError(403, 'Origine interdite.');
    const { user } = await requireUser(); enabled();
    const parsed = actions.safeParse(await readPrivacyJson(request, 65536));
    if (!parsed.success) throw new HttpError(400, 'Préparation média invalide.');
    // Le plafond le plus restrictif reste appliqué : aucun plan client n’est accepté.
    await checkRateLimit(user.id, 'solo');
    const admin = createAdminSupabase();
    if (parsed.data.action === 'cancel') {
      const { data, error } = await admin.rpc('media_job_cancel', { p_user: user.id, p_job: parsed.data.jobId });
      if (error) throw new Error('Annulation indisponible.');
      if (!data) throw new HttpError(409, 'Préparation introuvable ou déjà terminée.');
      return respond({ cancelled: true });
    }
    const input = parsed.data;
    const violations = applyRules(input.caption, input.platform);
    const risk = riskFrom(violations, 0);
    const { data, error } = await admin.rpc('media_job_enqueue', {
      p_user: user.id, p_assets: input.assetIds, p_caption: input.caption, p_platform: input.platform,
      p_analysis: { score: 100 - risk, riskLevel: levelFromRisk(risk), violations },
    });
    if (error) {
      if (error.code === '42501') throw new HttpError(403, 'Ce média ne peut pas être utilisé par ce compte.');
      if (error.code === '54000') throw new HttpError(429, 'Huit préparations actives maximum.');
      if (['22023', '22P02', '23514'].includes(error.code)) throw new HttpError(422, 'Médias expirés, incompatibles ou non confirmés.');
      throw new Error('File indisponible.');
    }
    return respond({ jobId: data, notice: 'Préparation en attente. Seule la légende sera contrôlée automatiquement, sans analyse IA des médias.' }, 202);
  } catch (error) { return failure(error); }
}
