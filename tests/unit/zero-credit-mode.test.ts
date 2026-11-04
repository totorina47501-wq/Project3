import { describe, expect, it } from 'vitest';
import { checkInputSchema } from '../../lib/ai/schemas';
describe('Mode zéro crédit OpenAI par défaut', () => {
  it('n active pas les appels IA sans choix explicite', () => {
    const parsed = checkInputSchema.parse({
      caption: 'Mon code promo !', platform: 'instagram', mediaType: 'none',
    });
    expect(parsed.execution).toBe('rules_only');
  });
  it('autorise le mode IA uniquement lorsque demandé explicitement', () => {
    expect(checkInputSchema.parse({
      caption:'Bonjour',platform:'instagram',mediaType:'none',execution:'ai',
    }).execution).toBe('ai');
  });
  it('rejette les exécutions non reconnues', () => {
    expect(checkInputSchema.safeParse({
      caption:'Bonjour',platform:'instagram',execution:'full',
    }).success).toBe(false);
  });
});
