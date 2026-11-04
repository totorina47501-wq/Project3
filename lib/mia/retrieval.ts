// RAG Mia : lexical par défaut ; fusion pgvector avec index complet et activation explicite.
import { createAdminSupabase } from '@/lib/supabase/admin';
import { openaiCapabilityEnabled, OPENAI_MODELS } from '@/lib/openai/config';
import { chooseLawSources, validatedLawSource, type LawSource } from '@/lib/mia/ranking';
import { hasCompleteLawIndex, MIA_MIN_VECTOR_SIMILARITY, rankHybridLawSources } from '@/lib/mia/hybrid';

export async function retrieveLawSources(question: string): Promise<LawSource[]> {
  const vectorEnabled = process.env.MIA_VECTOR_SEARCH_ENABLED === 'true' &&
    openaiCapabilityEnabled('embeddings', process.env) &&
    Boolean(process.env.OPENAI_API_KEY?.trim());
  const admin = createAdminSupabase();
  const { data, error, count } = await admin.from('law_documents')
    .select('article_ref,content,source_url,effective_on,checked_at', { count: 'exact' })
    .order('article_ref', { ascending: true }).limit(30);
  if (error || !data) throw new Error('Corpus de référence indisponible.');

  const sources: LawSource[] = data.flatMap((item) => {
    const validated = validatedLawSource(item);
    return validated ? [validated] : [];
  });
  const lexical = chooseLawSources(question, sources);
  // Les appels embeddings ne sont jamais tentés si l'index est partiel, le modèle
  // diverge, la lecture est tronquée ou une référence a échoué au contrôle.
  if (!vectorEnabled || count !== data.length || sources.length !== data.length) return lexical;
  const { data: indexRows, error: indexError, count: indexCount } =
    await admin.from('law_documents')
      .select('article_ref,embedding_model,embedding', { count: 'exact' }).limit(30);
  const references = new Set(sources.map((source) => source.articleRef));
  if (indexError || !indexRows || indexCount !== data.length ||
      !indexRows.every((row) => references.has(row.article_ref)) ||
      !hasCompleteLawIndex(indexRows, OPENAI_MODELS.embeddings)) return lexical;

  try {
    const { generateLegalEmbedding } = await import('@/lib/openai/embeddings');
    const generated = await generateLegalEmbedding(question);
    const { data: matches, error: rpcError } = await admin.rpc('match_law_documents', {
      query_embedding: '[' + generated.vector.join(',') + ']',
      match_count: 5,
      min_similarity: MIA_MIN_VECTOR_SIMILARITY,
    });
    if (rpcError) throw new Error('Recherche vectorielle indisponible.');
    return rankHybridLawSources(question, sources, matches);
  } catch {
    // Aucun texte personnel ni référence de conversation n'est journalisé.
    console.warn('[mentioncheck][mia_vector_fallback]');
    return lexical;
  }
}
