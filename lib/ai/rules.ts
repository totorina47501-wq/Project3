// Chemin : lib/ai/rules.ts
import type { Platform, Violation } from '@/lib/ai/schemas';

// Ces détecteurs exposent des indicateurs : certains sont des heuristiques UX.
const explicit = /(?:\bpublicit[eé](?![\p{L}\p{N}_])|\bcollaboration commerciale\b|\bcommunication commerciale\b|\bpartenariat r[eé]mun[eé]r[eé](?![\p{L}\p{N}_])|\bcontenu sponsoris[eé](?![\p{L}\p{N}_])|\bsponsoris[eé](?![\p{L}\p{N}_])|#(?:publicit[eé]|sponsoris[eé]|ad)(?![\p{L}\p{N}_])|\ben collaboration avec\b)/iu;
const ambiguous = /(?:#collab\b|#sp\b|\bcollab\b|\bmerci\s+@[\w.]+)/i;
const affiliate = /(?:affili(?:ation|[eé])|lien partenaire|commission sur les ventes|[?&](?:aff|affiliate|ref)=)/i;
const promo = /(?:code\s+promo|-\s?\d{1,2}\s?%|r[eé]duction)/i;

function flag(code: string, severity: Violation['severity'], title: string, explanation: string, source: string): Violation {
  return { code, severity, title, explanation, source };
}

export function applyRules(caption: string, platform: Platform): Violation[] {
  const violations: Violation[] = [];
  const match = caption.match(explicit);
  if (!match) {
    violations.push(flag('R1', 'critical', 'Mention commerciale absente',
      'Ajoute une indication explicite et facilement identifiable si cette publication correspond à une collaboration commerciale.',
      'Loi n° 2023-451, art. 5-2'));
  } else if ((match.index ?? 0) > 125) {
    violations.push(flag('R2', 'medium', 'Mention peu visible',
      'Sur ' + platform + ', la mention apparaît après les 125 premiers caractères : avance-la pour renforcer sa visibilité (heuristique UX).',
      'Heuristique de visibilité'));
  }
  if (match && (match.index ?? 0) > caption.length * 0.75 && /#[\wÀ-ÿ]+/.test(caption.slice(-100))) {
    violations.push(flag('R3', 'medium', 'Mention noyée dans les hashtags',
      'La divulgation pourrait être difficile à repérer dans la fin des hashtags.',
      'Heuristique de visibilité'));
  }
  if (affiliate.test(caption) && !match) {
    violations.push(flag('R5', 'high', 'Affiliation sans divulgation claire',
      'Le contenu comporte un indice d affiliation. Vérifie la contrepartie commerciale et sa transparence.',
      'Loi n° 2023-451, art. 1 et 5-2'));
  }
  if (ambiguous.test(caption) && !match) {
    violations.push(flag('R6', 'high', 'Formulation ambiguë',
      'Un simple « collab », « sp » ou remerciement peut ne pas informer clairement le public.',
      'Loi n° 2023-451, art. 5-2'));
  }
  if (promo.test(caption) && match && (match.index ?? 0) > 125) {
    violations.push(flag('R7', 'low', 'Visibilité à renforcer',
      'Avec un code promotionnel, mets la mention commerciale au début pour plus de clarté ; le gras n est pas obligatoire.',
      'Heuristique produit'));
  }
  return violations;
}

export function riskFrom(violations: Violation[], aiConfidence: number): number {
  // Score déterministe, plafonné. Les observations incertaines IA n'ajoutent
  // qu'un petit coefficient et ne remplacent pas les violations explicites.
  const weights = { low: 6, medium: 18, high: 32, critical: 55 };
  const total = violations.reduce((sum, item) => sum + weights[item.severity], 0);
  // Une confiance IA malformée ne doit jamais produire NaN dans le score archivé.
  const confidence = Number.isFinite(aiConfidence) ? Math.min(1, Math.max(0, aiConfidence)) : 0;
  return Math.min(100, total + Math.round(confidence * 5));
}

export function levelFromRisk(risk: number): 'low' | 'medium' | 'high' | 'critical' {
  if (risk >= 75) return 'critical';
  if (risk >= 50) return 'high';
  if (risk >= 25) return 'medium';
  return 'low';
}
