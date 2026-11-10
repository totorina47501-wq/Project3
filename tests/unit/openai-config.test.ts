import { describe, expect, it } from 'vitest';
import {
  assertOpenAIAllowed, openaiCapabilityEnabled, openaiReadiness,
  estimateChatCostUsd, estimateAudioCostUsd, estimateEmbeddingCostUsd,
  OpenAICapabilityDisabledError, MissingOpenAIKeyError, OPENAI_MODELS,
} from '../../lib/openai/config';

describe('OpenAI : préparation sans émission de requêtes', () => {
  it('audio et embeddings sont toujours éteints par défaut', () => {
    const env = { OPENAI_API_KEY:'sk-test-never-used' };
    expect(openaiCapabilityEnabled('audio',env)).toBe(false);
    expect(openaiCapabilityEnabled('embeddings',env)).toBe(false);
    expect(() => assertOpenAIAllowed('audio',env)).toThrow(OpenAICapabilityDisabledError);
    expect(() => assertOpenAIAllowed('embeddings',env)).toThrow(OpenAICapabilityDisabledError);
  });
  it('refuse tout appel payant par défaut et garde un coupe-circuit général', () => {
    expect(openaiCapabilityEnabled('text',{})).toBe(false);
    expect(openaiCapabilityEnabled('vision',{})).toBe(false);
    expect(openaiCapabilityEnabled('text',{OPENAI_TEXT_ENABLED:'true'})).toBe(true);
    expect(openaiCapabilityEnabled('vision',{OPENAI_VISION_ENABLED:'true'})).toBe(true);
    expect(openaiCapabilityEnabled('text',{OPENAI_TEXT_ENABLED:'TRUE'})).toBe(false);
    const env = { OPENAI_PAUSED:'true', OPENAI_API_KEY:'sk-test',
      OPENAI_TEXT_ENABLED:'true', OPENAI_VISION_ENABLED:'true',
      OPENAI_AUDIO_ENABLED:'true', OPENAI_EMBEDDINGS_ENABLED:'true' };
    for (const cap of ['text','vision','audio','embeddings'] as const) {
      expect(openaiCapabilityEnabled(cap,env)).toBe(false);
      expect(() => assertOpenAIAllowed(cap,env)).toThrow(OpenAICapabilityDisabledError);
    }
  });
  it('aucun appel client sans clé secrète côté serveur', () => {
    expect(() => assertOpenAIAllowed('text',{})).toThrow(OpenAICapabilityDisabledError);
    expect(() => assertOpenAIAllowed('text',{OPENAI_TEXT_ENABLED:'true'})).toThrow(MissingOpenAIKeyError);
    expect(() => assertOpenAIAllowed('audio',{OPENAI_AUDIO_ENABLED:'true'}))
      .toThrow(MissingOpenAIKeyError);
  });
  it('expose seulement un booléen de configuration, jamais la clé', () => {
    const status = openaiReadiness({OPENAI_API_KEY:'secret-sensible',OPENAI_TEXT_ENABLED:'true'});
    expect(status.keyConfigured).toBe(true);
    expect(JSON.stringify(status)).not.toContain('secret-sensible');
    expect(status.modelAudio).toBe('gpt-transcribe');
    expect(OPENAI_MODELS.embeddings).toBe('text-embedding-3-small');
  });
  it('corrige la grille tarifaire GPT-4o et borne les estimations', () => {
    expect(estimateChatCostUsd(1000,500)).toBe(0.0075);
    expect(estimateChatCostUsd(-2,0)).toBe(0);
    expect(estimateAudioCostUsd(60)).toBe(0.0045);
    expect(estimateEmbeddingCostUsd(1_000_000)).toBe(0.02);
    expect(() => estimateAudioCostUsd(61)).toThrow();
  });
});
