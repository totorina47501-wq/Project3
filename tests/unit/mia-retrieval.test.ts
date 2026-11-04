import { describe, expect, it } from 'vitest';
import { chooseLawSources, validatedLawSource, type LawSource } from '../../lib/mia/ranking';
import { miaQuestionSchema, miaModelSchema } from '../../lib/mia/schemas';
import { hasCompleteLawIndex, rankHybridLawSources, MIA_MIN_VECTOR_SIMILARITY } from '../../lib/mia/hybrid';

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
  it('n’utilise pas les synonymes sans correspondance directe', () => {
    expect(chooseLawSources('Je parle de sponsoring', [
      { ...base, articleRef: 'X', content: 'Publicité commerciale.' },
    ])).toEqual([]);
  });
  it('reconnaît photo retouchée et ignore une question générique', () => {
    expect(chooseLawSources('Faut-il signaler une photo retouchée ?', docs)[0]?.articleRef)
      .toBe('A-5');
    expect(chooseLawSources('Bonjour, une question sur une publication ?', docs)).toEqual([]);
  });
  it('n’autorise le mode vectoriel que pour un corpus complètement indexé', () => {
    const indexed = [{ embedding: '[0.1]', embedding_model: 'text-embedding-3-small' }];
    expect(hasCompleteLawIndex(indexed, 'text-embedding-3-small')).toBe(true);
    expect(hasCompleteLawIndex([...indexed, { embedding: null, embedding_model: 'text-embedding-3-small' }],
      'text-embedding-3-small')).toBe(false);
    expect(hasCompleteLawIndex(indexed, 'another-model')).toBe(false);
    expect(hasCompleteLawIndex([], 'text-embedding-3-small')).toBe(false);
  });
  it('fusionne le vectoriel aux résultats lexicaux sans dépasser quatre sources', () => {
    const matched = [
      { article_ref: 'A-5', source_url: base.sourceUrl, similarity: 0.94 },
      { article_ref: 'A-5-2', source_url: base.sourceUrl, similarity: 0.88 },
    ];
    const result = rankHybridLawSources('Dois-je déclarer une publicité ?', docs, matched);
    expect(result.map((source) => source.articleRef)).toContain('A-5');
    expect(result.map((source) => source.articleRef)).toContain('A-5-2');
    expect(result.length).toBeLessThanOrEqual(4);
  });
  it('rejette les correspondances vectorielles inconnues, falsifiées et sous le seuil', () => {
    const matches = [
      { article_ref: 'A-5', source_url: 'https://fraud.example', similarity: 1 },
      { article_ref: 'UNKNOWN', source_url: base.sourceUrl, similarity: 1 },
      { article_ref: 'A-1', source_url: base.sourceUrl, similarity: MIA_MIN_VECTOR_SIMILARITY - 0.01 },
      { article_ref: 'A-4', source_url: base.sourceUrl, similarity: Number.NaN },
    ];
    expect(rankHybridLawSources('Carburant moteur demain', docs, matches)).toEqual([]);
    expect(rankHybridLawSources('Carburant moteur demain', docs, null)).toEqual([]);
  });
  it('ne renvoie que les sources officielles déjà validées lors de la fusion', () => {
    const matches = [{ article_ref: 'A-5', source_url: base.sourceUrl, similarity: 0.95 }];
    const result = rankHybridLawSources('Comportement hors corpus', docs, matches);
    expect(result).toEqual([docs[2]]);
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
