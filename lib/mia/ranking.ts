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
  'bonjour', 'merci', 'salut', 'demain', 'hier', 'aujourd', 'hui', 'prix', 'combien',
  'besoin', 'obligation', 'obligatoire', 'possible', 'necessaire', 'faire', 'mettre',
  'publication', 'publier', 'contenu', 'reseau', 'sociaux', 'question', 'regle',
]);
const KEYWORDS: Record<string, string[]> = {
  commercial: ['publicite', 'collaboration', 'sponsorise', 'mention', 'affiliation', 'promo', 'partenariat', 'sponsoring', 'sponsor', 'placement'],
  retouche: ['retouchee', 'retouche', 'filtre', 'image', 'virtuel', 'intelligence', 'artificielle', 'photo', 'photographie', 'ia'],
  definition: ['influenceur', 'influence', 'activite', 'remuneration', 'contrepartie', 'cadeau', 'gratuit', 'offert'],
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
  if (!input.size) return [];
  const expansions = new Set(input);
  for (const group of Object.values(KEYWORDS)) {
    if (group.some((word) => input.has(word))) group.forEach((word) => expansions.add(word));
  }
  return sources.map((source) => {
    const terms = new Set(words(source.content + ' ' + source.articleRef));
    const direct = [...input].filter((word) => terms.has(word)).length;
    const synonyms = [...expansions].filter((word) => !input.has(word) && terms.has(word)).length;
    // Les synonymes seuls ne prouvent jamais la pertinence juridique.
    const overlap = direct ? direct * 2 + Math.min(synonyms, 4) * 0.25 : 0;
    return { source, overlap };
  }).sort((a, b) => b.overlap - a.overlap || a.source.articleRef.localeCompare(b.source.articleRef))
    .filter((entry) => entry.overlap > 0)
    .slice(0, Math.min(5, Math.max(1, max))).map((entry) => entry.source);
}


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

