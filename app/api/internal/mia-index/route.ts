// One-shot corpus indexing on the existing Worker, behind an existing operator token.
// No endpoint can change the search activation flags or reveal secret values.
import { createHash, timingSafeEqual } from 'node:crypto';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { generateLegalEmbedding } from '@/lib/openai/embeddings';
import { OPENAI_MODELS } from '@/lib/openai/config';
import { validatedLawSource } from '@/lib/mia/ranking';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const MAX_DOCUMENTS = 5;

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
    const { data, count, error } = await admin.from('law_documents')
      .select('id,article_ref,content,source_url,embedding,embedding_model', { count: 'exact' })
      .order('article_ref', { ascending: true }).limit(MAX_DOCUMENTS + 1);
    if (error || !data || count !== data.length || data.length !== MAX_DOCUMENTS ||
      !data.every((item) => validatedLawSource(item)))
      return Response.json({ error: 'Corpus incomplet ou non validé.' }, { status: 409, headers });
    const pending = data.filter((item) => item.embedding == null ||
      item.embedding_model !== OPENAI_MODELS.embeddings);
    if (!execute) return Response.json({ dryRun: true, total: data.length, pending: pending.length,
      model: OPENAI_MODELS.embeddings }, { headers });
    let indexed = 0;
    for (const item of pending) {
      const result = await generateLegalEmbedding(item.content);
      const { data: updated, error: updateError } = await admin.from('law_documents')
        .update({ embedding: '[' + result.vector.join(',') + ']', embedding_model: result.model })
        .eq('id', item.id).eq('content', item.content).select('id');
      if (updateError || updated?.length !== 1) throw new Error('Écriture du corpus impossible.');
      indexed++;
    }
    const { data: after, error: verifyError } = await admin.from('law_documents')
      .select('article_ref,embedding_model,embedding');
    if (verifyError || !after || after.length !== MAX_DOCUMENTS ||
      after.some((item) => item.embedding == null || item.embedding_model !== OPENAI_MODELS.embeddings))
      throw new Error('Index incomplet après traitement.');
    return Response.json({ indexed, total: MAX_DOCUMENTS, verified: true,
      vectorSearchEnabled: process.env.MIA_VECTOR_SEARCH_ENABLED === 'true' }, { headers });
  } catch {
    console.warn('[mentioncheck][mia_index_failed]');
    return Response.json({ error: 'Indexation indisponible ; vérifier les vecteurs Supabase.' },
      { status: 503, headers });
  }
}
