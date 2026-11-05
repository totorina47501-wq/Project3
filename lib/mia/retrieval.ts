// RAG Mia : lexical par défaut ; fusion pgvector avec index complet et activation explicite.
import { createAdminSupabase } from '@/lib/supabase/admin';
import { openaiCapabilityEnabled, OPENAI_MODELS } from '@/lib/openai/config';
import { chooseLawSources, validatedLawSource, type LawSource } from '@/lib/mia/ranking';
import { hasCompleteLawIndex, MIA_MIN_VECTOR_SIMILARITY, rankHybridLawSources } from '@/lib/mia/hybrid';
import type { ModelTelemetry } from '@/lib/ai/schemas';

const CORPUS_PAGE_SIZE = 30;
const MAX_CORPUS_ROWS = 1000;

// Lecture bornée et paginée : aucune suppression silencieuse au-delà des 30 premières sources.
async function readLawCorpus(admin: ReturnType<typeof createAdminSupabase>) {
  const rows: Array<{ article_ref: unknown; content: unknown; source_url: unknown; effective_on?: unknown; checked_at?: unknown }> = [];
  let total = 0;
  for (let offset = 0; offset < MAX_CORPUS_ROWS; offset += CORPUS_PAGE_SIZE) {
    const query = admin.from('law_documents')
      .select('article_ref,content,source_url,effective_on,checked_at', { count: 'exact' })
      .order('article_ref', { ascending: true });
    const { data, error, count } = offset === 0
      ? await query.limit(CORPUS_PAGE_SIZE)
      : await query.range(offset, offset + CORPUS_PAGE_SIZE - 1);
    if (error || !data || count === null) throw new Error('Corpus de référence indisponible.');
    if (offset === 0) total = count;
    if (count !== total) throw new Error('Corpus modifié pendant la lecture.');
    rows.push(...data);
    if (rows.length >= total) return { rows, total };
  }
  throw new Error('Corpus juridique trop volumineux pour cette stratégie de recherche.');
}

export async function retrieveLawSources(question: string, onEmbeddingUsage?: (usage: ModelTelemetry) => void | Promise<void>): Promise<LawSource[]> {
  const vectorEnabled = process.env.MIA_VECTOR_SEARCH_ENABLED === 'true' &&
    openaiCapabilityEnabled('embeddings', process.env) &&
    Boolean(process.env.OPENAI_API_KEY?.trim());
  const admin = createAdminSupabase();
  const { rows, total } = await readLawCorpus(admin);
  const sources: LawSource[] = rows.flatMap((item) => {
    const validated = validatedLawSource(item);
    return validated ? [validated] : [];
  });
  const lexical = chooseLawSources(question, sources);
  // Les appels embeddings ne sont jamais tentés si l'index est partiel, le modèle
  // diverge, la lecture est tronquée ou une référence a échoué au contrôle.
  if (!vectorEnabled || total !== rows.length || sources.length !== rows.length || total > CORPUS_PAGE_SIZE) return lexical;
  const { data: indexRows, error: indexError, count: indexCount } =
    await admin.from('law_documents')
      .select('article_ref,embedding_model,embedding', { count: 'exact' }).limit(30);
  const references = new Set(sources.map((source) => source.articleRef));
  if (indexError || !indexRows || indexCount !== rows.length ||
      !indexRows.every((row) => references.has(row.article_ref)) ||
      !hasCompleteLawIndex(indexRows, OPENAI_MODELS.embeddings)) return lexical;

  let recordingUsage = false;
  try {
    const { generateLegalEmbedding } = await import('@/lib/openai/embeddings');
    const started = Date.now();
    const generated = await generateLegalEmbedding(question);
    // L’embedding est facturable même si la RPC suivante échoue : tracer avant.
    // La journalisation ne doit pas être absorbée par le repli de recherche.
    recordingUsage = Boolean(onEmbeddingUsage);
    await onEmbeddingUsage?.({ model: generated.model, promptTokens: generated.tokens,
      completionTokens: 0, estimatedCostUsd: generated.estimatedCostUsd, latencyMs: Date.now() - started });
    recordingUsage = false;
    const { data: matches, error: rpcError } = await admin.rpc('match_law_documents', {
      query_embedding: '[' + generated.vector.join(',') + ']',
      match_count: 5,
      min_similarity: MIA_MIN_VECTOR_SIMILARITY,
    });
    if (rpcError) throw new Error('Recherche vectorielle indisponible.');
    return rankHybridLawSources(question, sources, matches);
  } catch (error) {
    if (recordingUsage) throw error;
    // Aucun texte personnel ni référence de conversation n'est journalisé.
    console.warn('[mentioncheck][mia_vector_fallback]');
    return lexical;
  }
}
