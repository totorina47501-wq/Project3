import { requireUser, publicError, HttpError } from '@/lib/security/auth';
import { isSameOrigin } from '@/lib/security/origin';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { POST as indexCorpus } from '@/app/api/internal/mia-index/route';
import { readLawIndexPlan } from '@/lib/mia/index-corpus';
import { MAX_INDEX_BATCH } from '@/lib/mia/index-plan.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };

async function requireOperator() {
  const { user } = await requireUser();
  const allowed = (process.env.MIA_ADMIN_USER_IDS ?? '').split(',').map(v => v.trim()).filter(Boolean);
  if (!allowed.includes(user.id)) throw new HttpError(403, 'Accès administrateur refusé.');
}

export async function GET() {
  try {
    await requireOperator();
    const admin = createAdminSupabase();
    const plan=await readLawIndexPlan(admin);
    return Response.json({ total: plan.total, indexed: plan.indexed, pending:plan.pending.length, maxBatch:MAX_INDEX_BATCH,
      enabled: process.env.OPENAI_EMBEDDINGS_ENABLED === 'true' && process.env.OPENAI_PAUSED !== 'true' && Boolean(process.env.OPENAI_API_KEY) }, { headers });
  } catch (error) {
    const { status, message } = publicError(error);
    return Response.json({ error: message }, { status, headers });
  }
}

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) throw new HttpError(403, 'Origine interdite.');
    await requireOperator();
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || !('confirmation' in body) || body.confirmation !== 'INDEXER-5')
      throw new HttpError(422, 'Confirmation explicite requise.');
    const token = process.env.MIA_INDEX_TOKEN ?? process.env.MEDIA_RETENTION_TOKEN;
    if (!token || token.length < 32) throw new HttpError(503, 'Jeton opérateur non configuré.');
    const internalRequest = new Request('https://mentioncheck.internal/api/internal/mia-index?execute=true', {
      method: 'POST', headers: { Authorization: 'Bearer ' + token },
    });
    return await indexCorpus(internalRequest);
  } catch (error) {
    const { status, message } = publicError(error);
    return Response.json({ error: message }, { status, headers });
  }
}
