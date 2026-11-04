// Sélection lexicale pure et testable des synthèses du corpus français.
export type LawSource = {
  articleRef: string;
  content: string;
  sourceUrl: string;
  effectiveOn: string | null;
  checkedAt: string | null;
};

const STOP_WORDS = new Set([
  'dans', 'pour', 'avec', 'sans', 'quel', 'quelle', 'quelles', 'quels',
  'puis', 'alors', 'est', 'sont', 'une', 'des', 'les', 'aux', 'mes',
  'mon', 'ton', 'leur', 'leurs', 'donc', 'comment', 'dois', 'fait',
  'etre', 'sur', 'que', 'qui', 'par', 'quoi', 'peut', 'faut', 'elle',
  'il', 'nous', 'vous', 'cela', 'aussi', 'doit', 'cette', 'cet',
]);
const KEYWORDS: Record<string, string[]> = {
  commercial: ['publicite', 'collaboration', 'sponsorise', 'mention', 'affiliation', 'promo', 'partenariat'],
  retouche: ['retouchee', 'retouche', 'filtre', 'image', 'virtuel', 'intelligence', 'artificielle'],
  definition: ['influenceur', 'influence', 'activite', 'remuneration', 'contrepartie'],
  restriction: ['interdit', 'restriction', 'sante', 'medical', 'produit', 'risque'],
};
function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ');
}
function words(text: string): string[] {
  return normalize(text).split(/\s+/).map((word) =>
    word.length > 4 && word.endsWith('s') ? word.slice(0, -1) : word,
  ).filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}
export function chooseLawSources(question: string, sources: LawSource[], max = 4): LawSource[] {
  const input = new Set(words(question));
  const expansions = new Set(input);
  for (const group of Object.values(KEYWORDS)) {
    if (group.some((word) => input.has(word))) group.forEach((word) => expansions.add(word));
  }
  return sources.map((source) => {
    const terms = new Set(words(source.content + ' ' + source.articleRef));
    const overlap = [...expansions].reduce((sum, word) =>
      sum + (terms.has(word) ? (input.has(word) ? 2 : 0.25) : 0), 0);
    return { source, overlap };
  }).sort((a, b) => b.overlap - a.overlap || a.source.articleRef.localeCompare(b.source.articleRef))
    .filter((entry) => entry.overlap > 0)
    .slice(0, Math.min(5, Math.max(1, max))).map((entry) => entry.source);
}

