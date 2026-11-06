// RAG Mia : lexical par défaut ; fusion pgvector avec index complet et activation explicite.
import { createAdminSupabase } from '@/lib/supabase/admin';
import { openaiCapabilityEnabled, OPENAI_MODELS } from '@/lib/openai/config';
import { chooseLawSources, validatedLawSource, type LawSource } from '@/lib/mia/ranking';
import { MIA_MIN_VECTOR_SIMILARITY, rankHybridLawSources } from '@/lib/mia/hybrid';
import { readCorpusPages } from '@/lib/mia/corpus-pages.mjs';
import type { ModelTelemetry } from '@/lib/ai/schemas';

// Lecture bornée et paginée : aucune suppression silencieuse au-delà des 30 premières sources.
async function readLawCorpus(admin: ReturnType<typeof createAdminSupabase>) {
  return readCorpusPages(async (offset, size) => {
    const query = admin.from('law_documents')
      .select('article_ref,content,source_url,effective_on,checked_at', { count: 'exact' })
      .order('article_ref', { ascending: true });
    return offset === 0 ? await query.limit(size) : await query.range(offset, offset + size - 1);
  });
}

export async function retrieveLawSources(question: string, onEmbeddingUsage?: (usage: ModelTelemetry) => void | Promise<void>): Promise<LawSource[]> {
  const vectorEnabled = process.env.MIA_VECTOR_SEARCH_ENABLED === 'true' &&
    openaiCapabilityEnabled('embeddings', process.env) &&
    Boolean(process.env.OPENAI_API_KEY?.trim());
  const admin = createAdminSupabase();
  const rows = await readLawCorpus(admin);
  const sources: LawSource[] = rows.flatMap((item) => {
    const validated = validatedLawSource(item);
    return validated ? [validated] : [];
  });
  const lexical = chooseLawSources(question, sources);
  // Les appels embeddings ne sont jamais tentés si l'index est partiel, le modèle
  // diverge, la lecture est tronquée ou une référence a échoué au contrôle.
  if (!vectorEnabled || sources.length !== rows.length || rows.length === 0) return lexical;
  // Seules les métadonnées traversent le réseau : pas 1 536 nombres par document.
  let indexRows: Array<{ article_ref: string; embedding_model: string }>;
  try {
    indexRows = await readCorpusPages(async (offset, size) => {
      const query = admin.from('law_documents')
        .select('article_ref,embedding_model', { count: 'exact' })
        .not('embedding', 'is', null).eq('embedding_model', OPENAI_MODELS.embeddings)
        .order('article_ref', { ascending: true });
      return offset === 0 ? await query.limit(size) : await query.range(offset, offset + size - 1);
    });
  } catch { return lexical; }
  const references = new Set(sources.map((source) => source.articleRef));
  if (indexRows.length !== rows.length || new Set(indexRows.map(row => row.article_ref)).size !== rows.length ||
      !indexRows.every((row) => references.has(row.article_ref)) ||
      !indexRows.every(row => row.embedding_model === OPENAI_MODELS.embeddings)) return lexical;

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
