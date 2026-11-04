// Classement hybride pur : aucune dépendance serveur, réseau ou OpenAI.
import { chooseLawSources, type LawSource } from './ranking';

export const MIA_MIN_VECTOR_SIMILARITY = 0.78;
export type MiaVectorMatch = {
  article_ref: unknown;
  source_url: unknown;
  similarity: unknown;
};

export function hasCompleteLawIndex(
  rows: ReadonlyArray<{ embedding?: unknown; embedding_model?: unknown }>,
  model: string,
): boolean {
  // PostgreSQL garantit la dimension vector(1536) au niveau de la colonne.
  return rows.length > 0 && rows.every((row) =>
    row.embedding !== null && row.embedding !== undefined && row.embedding_model === model);
}

export function rankHybridLawSources(
  question: string,
  trustedSources: LawSource[],
  candidateMatches: unknown,
  max = 4,
): LawSource[] {
  const trusted = new Map(trustedSources.map((source) => [source.articleRef, source]));
  const scores = new Map<string, number>();
  chooseLawSources(question, trustedSources, 5).forEach((source, rank) => {
    scores.set(source.articleRef, 1.2 / (60 + rank));
  });

  const candidates: MiaVectorMatch[] = Array.isArray(candidateMatches) ? candidateMatches : [];
  const verified = candidates.flatMap((candidate) => {
    if (!candidate || typeof candidate.article_ref !== 'string' ||
      typeof candidate.source_url !== 'string' ||
      typeof candidate.similarity !== 'number' || !Number.isFinite(candidate.similarity) ||
      candidate.similarity < MIA_MIN_VECTOR_SIMILARITY || candidate.similarity > 1) return [];
    const source = trusted.get(candidate.article_ref);
    // Toujours retourner la synthèse et l'URL validées, jamais les données non fiables du RPC.
    if (!source || source.sourceUrl !== candidate.source_url) return [];
    return [{ source, similarity: candidate.similarity }];
  }).sort((a, b) => b.similarity - a.similarity);

  const seen = new Set<string>();
  verified.forEach(({ source }, rank) => {
    if (seen.has(source.articleRef)) return;
    seen.add(source.articleRef);
    scores.set(source.articleRef, (scores.get(source.articleRef) ?? 0) + 1 / (60 + rank));
  });

  return [...scores].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, Math.min(5, Math.max(1, max)))
    .flatMap(([articleRef]) => {
      const source = trusted.get(articleRef);
      return source ? [source] : [];
    });
}
