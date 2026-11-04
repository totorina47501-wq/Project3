// Chemin : lib/mia/retrieval.ts
// RAG documentaire : uniquement des références juridiques contrôlées côté serveur.
// Les cinq synthèses seed sont consultables sans embeddings ; la recherche vectorielle
// sera activée après une indexation formellement vérifiée du corpus.
import { createAdminSupabase } from '@/lib/supabase/admin';
import { chooseLawSources, validatedLawSource, type LawSource } from '@/lib/mia/ranking';

export async function retrieveLawSources(question: string): Promise<LawSource[]> {
  const { data, error } = await createAdminSupabase().from('law_documents')
    .select('article_ref,content,source_url,effective_on,checked_at')
    .order('article_ref', { ascending: true }).limit(30);
  if (error || !data) throw new Error('Corpus de référence indisponible.');
  const sources: LawSource[] = data.flatMap((item) => {
    const validated = validatedLawSource(item);
    return validated ? [validated] : [];
  });
  return chooseLawSources(question, sources);
}
