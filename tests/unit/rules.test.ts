// Chemin : tests/unit/rules.test.ts
import { describe, expect, it } from 'vitest';
import { applyRules, riskFrom, levelFromRisk } from '../../lib/ai/rules';

describe('Règles déterministes MentionCheck', () => {
  it('détecte une absence de mention publicitaire', () => {
    const rules = applyRules('J adore ce produit. Code promo MIA10.', 'instagram');
    expect(rules.some((r) => r.code === 'R1')).toBe(true);
  });
  it('ne pénalise pas une mention clairement visible au début', () => {
    const rules = applyRules('PUBLICITÉ — voici mon expérience avec cette marque.', 'instagram');
    expect(rules.some((r) => r.code === 'R1')).toBe(false);
    expect(rules.some((r) => r.code === 'R2')).toBe(false);
  });
  it('signale une divulgation après 125 caractères comme heuristique', () => {
    const caption = 'Voici une nouveauté intéressante. '.repeat(5) + 'Publicité pour cette marque.';
    expect(applyRules(caption, 'tiktok').some((r) => r.code === 'R2')).toBe(true);
  });
  it('détecte un lien affilié non explicité', () => {
    expect(applyRules('Mon lien affiliation ici : exemple.fr?aff=123', 'youtube')
      .some((r) => r.code === 'R5')).toBe(true);
  });
  it('ne considère pas « collab » seul comme une mention claire', () => {
    expect(applyRules('Merci @marque pour cette collab !', 'instagram')
      .some((r) => r.code === 'R6')).toBe(true);
  });
  it('ne crée jamais de violation R8 : le hash est technique', () => {
    expect(applyRules('PUBLICITÉ — test du jour.', 'linkedin')
      .some((r) => r.code === 'R8')).toBe(false);
  });
  it('borne le risque entre 0 et 100', () => {
    const risk = riskFrom(applyRules('Lien affiliation et code promo, merci @marque', 'instagram'), 1);
    expect(risk).toBeGreaterThanOrEqual(0);
    expect(risk).toBeLessThanOrEqual(100);
    expect(levelFromRisk(risk)).toMatch(/^(low|medium|high|critical)$/);
  });
});
