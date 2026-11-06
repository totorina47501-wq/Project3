import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ chat: vi.fn(), retrieve: vi.fn() }));
vi.mock('@/lib/openai', () => ({ chatText: mocks.chat }));
vi.mock('@/lib/mia/retrieval', () => ({ retrieveLawSources: mocks.retrieve }));

import { answerMia } from '../../lib/mia/assistant';

const source = {
  articleRef: 'A-5-2',
  content: 'Synthèse éditoriale sur la transparence commerciale.',
  sourceUrl: 'https://www.legifrance.gouv.fr/loda/id/TEST',
  effectiveOn: null,
  checkedAt: null,
};
const usage = { model: 'gpt-4o', promptTokens: 10, completionTokens: 5, estimatedCostUsd: 0.0001, latencyMs: 1 };

beforeEach(() => vi.clearAllMocks());

describe('Mia assistant hors ligne', () => {
  it('ne conserve que les citations des sources récupérées et relaie le budget embedding', async () => {
    const embeddingUsage = {
      model: 'text-embedding-3-small', promptTokens: 4, completionTokens: 0,
      estimatedCostUsd: 0.000002, latencyMs: 1,
    };
    mocks.retrieve.mockImplementation(async (_question, reportUsage) => {
      await reportUsage(embeddingUsage);
      return [source];
    });
    mocks.chat.mockResolvedValue({
      value: { answer: 'Consulte la source officielle.', citations: ['A-5-2', 'UNKNOWN'] },
      usage,
    });
    const onEmbeddingUsage = vi.fn();

    const result = await answerMia('Quelle mention ?', [], {}, onEmbeddingUsage);

    expect(mocks.chat).toHaveBeenCalledOnce();
    expect(result.sources).toEqual([{
      articleRef: source.articleRef,
      sourceUrl: source.sourceUrl,
      effectiveOn: null,
      checkedAt: null,
    }]);
    expect(result.auxiliaryUsage).toEqual([embeddingUsage]);
    expect(onEmbeddingUsage).toHaveBeenCalledWith(embeddingUsage);
  });

  it('refuse hors corpus sans appeler le modèle ni comptabiliser de coût', async () => {
    mocks.retrieve.mockResolvedValue([]);

    const result = await answerMia('Quelle est la météo ?', []);

    expect(mocks.chat).not.toHaveBeenCalled();
    expect(result.answer).toContain('source juridique pertinente dans mon corpus');
    expect(result.sources).toEqual([]);
    expect(result.usage).toEqual({ promptTokens: 0, completionTokens: 0, estimatedCostUsd: 0 });
    expect(result.auxiliaryUsage).toEqual([]);
  });
});
