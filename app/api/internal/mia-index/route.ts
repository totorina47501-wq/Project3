// One-shot corpus indexing on the existing Worker, behind an existing operator token.
// No endpoint can change the search activation flags or reveal secret values.
import { createHash, timingSafeEqual } from 'node:crypto';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { generateLegalEmbedding } from '@/lib/openai/embeddings';
import { OPENAI_MODELS } from '@/lib/openai/config';
import { readLawIndexPlan } from '@/lib/mia/index-corpus';
import { MAX_INDEX_BATCH } from '@/lib/mia/index-plan.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(request: Request, token: string): boolean {
  const value = request.headers.get('authorization') ?? '';
  if (!value.startsWith('Bearer ') || value.length > 1100) return false;
  const supplied = value.slice(7);
  if (!supplied) return false;
  return timingSafeEqual(createHash('sha256').update(supplied).digest(),
    createHash('sha256').update(token).digest());
}

export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  // Reuse the already configured private operator token; never expose it in logs.
  const token = process.env.MIA_INDEX_TOKEN ?? process.env.MEDIA_RETENTION_TOKEN;
  if (!token || token.length < 32) return Response.json({ error: 'Opération indisponible.' }, { status: 503, headers });
  if (!authorized(request, token)) return Response.json({ error: 'Accès refusé.' }, { status: 401, headers });
  const execute = new URL(request.url).searchParams.get('execute') === 'true';
  if (execute && (process.env.OPENAI_EMBEDDINGS_ENABLED !== 'true' ||
    process.env.OPENAI_PAUSED === 'true' || !process.env.OPENAI_API_KEY?.trim()))
    return Response.json({ error: 'Embeddings OpenAI désactivés.' }, { status: 503, headers });
  try {
    const admin = createAdminSupabase();
    const plan=await readLawIndexPlan(admin);
    if (!execute) return Response.json({ dryRun: true, total: plan.total, pending: plan.pending.length,
      batchSize: plan.batch.length, maxBatch: MAX_INDEX_BATCH, model: OPENAI_MODELS.embeddings }, { headers });
    let indexed = 0;
    for (const item of plan.batch) {
      const result = await generateLegalEmbedding(item.content);
      const { data: updated, error: updateError } = await admin.from('law_documents')
        .update({ embedding: '[' + result.vector.join(',') + ']', embedding_model: result.model })
        .eq('id', item.id).eq('content', item.content).eq('source_url',item.source_url).select('id');
      if (updateError || updated?.length !== 1) throw new Error('Écriture du corpus impossible.');
      indexed++;
    }
    const after=await readLawIndexPlan(admin);
    if (after.total !== plan.total) throw new Error('Corpus modifié pendant l’indexation.');
    return Response.json({ indexed, total: after.total, remaining:after.pending.length, verified:after.pending.length===0,
      vectorSearchEnabled: process.env.MIA_VECTOR_SEARCH_ENABLED === 'true' }, { headers });
  } catch {
    console.warn('[mentioncheck][mia_index_failed]');
    return Response.json({ error: 'Indexation indisponible ; vérifier les vecteurs Supabase.' },
      { status: 503, headers });
  }
}
