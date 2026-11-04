import { describe, expect, it } from 'vitest';
import { chooseLawSources, type LawSource } from '../../lib/mia/ranking';
import { miaQuestionSchema, miaModelSchema } from '../../lib/mia/schemas';
import { validatedLawSource } from '../../lib/mia/retrieval';

const base = { sourceUrl: 'https://www.legifrance.gouv.fr/loda/id/TEST',
  effectiveOn: null, checkedAt: null };
const docs: LawSource[] = [
  { ...base, articleRef: 'A-1', content: 'Définition activité influence commerciale et rémunération.' },
  { ...base, articleRef: 'A-5-2', content: 'Publicité collaboration commerciale et transparence des mentions.' },
  { ...base, articleRef: 'A-5', content: 'Images retouchées et images virtuelles générées par IA.' },
  { ...base, articleRef: 'A-4', content: 'Restrictions des promotions dans la santé.' },
];
describe('Mia documentaire', () => {
  it('priorise la divulgation en réponse à une question sur la publicité', () => {
    expect(chooseLawSources('Comment mentionner ma publicité et collaboration commerciale ?',docs)[0]?.articleRef)
      .toBe('A-5-2');
  });
  it('priorise les images retouchées', () => {
    expect(chooseLawSources('Une image retouchée nécessite une mention ?',docs)[0]?.articleRef)
      .toBe('A-5');
  });
  it('refuse les URL externes, les identifiants dangereux et les sources vides', () => {
    const source = { article_ref: 'A-5', content: 'Publicité commerciale',
      source_url: 'https://www.legifrance.gouv.fr/loda/id/TEST' };
    expect(validatedLawSource(source)?.articleRef).toBe('A-5');
    expect(validatedLawSource({ ...source, source_url: 'https://www.legifrance.gouv.fr.evil.example/' })).toBeNull();
    expect(validatedLawSource({ ...source, source_url: 'https://user:pass@www.legifrance.gouv.fr/' })).toBeNull();
    expect(validatedLawSource({ ...source, article_ref: '../escape' })).toBeNull();
    expect(validatedLawSource({ ...source, content: '   ' })).toBeNull();
  });
  it('ne cite aucun article pour une question hors corpus', () => {
    expect(chooseLawSources('Quel est le prix du carburant demain ?', docs)).toEqual([]);
  });
  it('ne retourne jamais plus de cinq sources', () => {
    expect(chooseLawSources('test', Array.from({length:20},(_,i) => ({
      ...base, articleRef:String(i),content:'test',
    })),50)).toHaveLength(5);
  });
  it('rejette les chaînes trop longues et les identifiants arbitraires', () => {
    expect(miaQuestionSchema.safeParse({question:'a'.repeat(1601)}).success).toBe(false);
    expect(miaQuestionSchema.safeParse({question:'Bonjour',conversationId:'../autre'}).success).toBe(false);
    expect(miaQuestionSchema.safeParse({question:'Bonjour',userId:'other'}).success).toBe(false);
  });
  it('borne la réponse structurée de GPT', () => {
    expect(miaModelSchema.safeParse({answer:'Réponse vérifiée.',citations:['A-5-2']}).success).toBe(true);
    expect(miaModelSchema.safeParse({answer:'',citations:[]}).success).toBe(false);
  });
});
