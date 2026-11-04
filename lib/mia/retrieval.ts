// Chemin : lib/mia/retrieval.ts
// RAG documentaire : uniquement des références juridiques contrôlées côté serveur.
// Les cinq synthèses seed sont consultables sans embeddings ; la recherche vectorielle
// sera activée après une indexation formellement vérifiée du corpus.
import { createAdminSupabase } from '@/lib/supabase/admin';
import { chooseLawSources, type LawSource } from '@/lib/mia/ranking';

export function validatedLawSource(item: {
  article_ref: unknown; content: unknown; source_url: unknown;
  effective_on?: unknown; checked_at?: unknown;
}): LawSource | null {
  if (typeof item.article_ref !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(item.article_ref)) return null;
  if (typeof item.content !== 'string' || !item.content.trim()) return null;
  if (typeof item.source_url !== 'string') return null;
  try {
    const url = new URL(item.source_url);
    if (url.protocol !== 'https:' || url.username || url.password ||
      url.port || !['www.legifrance.gouv.fr', 'www.economie.gouv.fr'].includes(url.hostname)) return null;
    return {
      articleRef: item.article_ref, content: item.content.slice(0, 2000),
      sourceUrl: url.toString(),
      effectiveOn: item.effective_on ? String(item.effective_on) : null,
      checkedAt: item.checked_at ? String(item.checked_at) : null,
    };
  } catch { return null; }
}

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
