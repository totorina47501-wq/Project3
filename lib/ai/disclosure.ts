// Contrôle produit de la lisibilité d'une mention sponsorisée.
// Ce test ne prétend pas capturer toutes les mentions juridiquement équivalentes.
import type { Violation } from '@/lib/ai/schemas';

const clearOpening = /^(?:(?:publicit[eé]|collaboration commerciale|communication commerciale|partenariat r[eé]mun[eé]r[eé] avec|#sponsoris[eé] par|#en collaboration avec)(?=$|[\s:—–-]))/iu;

// Les hashtags vagues isolés ne sont pas considérés comme explicites.
export function hasClearLeadingDisclosure(caption: string): boolean {
  return clearOpening.test(caption.trimStart());
}

export function needsVisibleDisclosure(violations: Pick<Violation, 'code'>[]): boolean {
  return violations.some(({ code }) => code === 'R1' || code === 'R2' || code === 'R3');
}

type Change = { before: string; after: string; reason: string };
export function improveSponsoredRewrite<T extends {
  rewrittenCaption: string; changes: Change[];
}>(candidate: T, violations: Pick<Violation, 'code'>[]): T {
  if (!needsVisibleDisclosure(violations) ||
      hasClearLeadingDisclosure(candidate.rewrittenCaption)) {
    return candidate;
  }
  // On propose cette étiquette car le formulaire indique « Légende sponsorisée ».
  // Le créateur valide lui-même la nature commerciale avant publication.
  const withoutVagueTag = candidate.rewrittenCaption.trim()
    .replace(/\s+#(?:collab|collaboration)(?=\s|$)/giu, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const corrected = 'Publicité — ' + withoutVagueTag;
  return {
    ...candidate,
    rewrittenCaption: corrected,
    changes: [
      ...candidate.changes.slice(0, 11),
      { before: candidate.rewrittenCaption, after: corrected,
        reason: 'Mention explicite et immédiatement visible pour une publication commerciale.' },
    ],
  };
}
