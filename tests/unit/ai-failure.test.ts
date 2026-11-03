import { describe, expect, it } from 'vitest';
import { classifyAiFailure } from '../../lib/ai/failure';
describe('Classification des erreurs IA sans divulgation', () => {
  it('identifie une clé absente sans en afficher la valeur', () => {
    expect(classifyAiFailure({name: 'MissingOpenAIKeyError'})).toBe('missing_key');
  });
  it('classe une clé invalide', () => {
    expect(classifyAiFailure({ status: 401, message: 'clé secrète' }))
      .toBe('authentication');
  });
  it('différencie les crédits et le débit API', () => {
    expect(classifyAiFailure({ status: 429, code: 'insufficient_quota' }))
      .toBe('credit');
    expect(classifyAiFailure({ status: 429, code: 'rate_limit_exceeded' }))
      .toBe('rate_limit');
  });
  it('détecte les pannes externes', () => {
    expect(classifyAiFailure({ status: 503 })).toBe('provider');
    expect(classifyAiFailure({ name: 'APIConnectionError' })).toBe('network');
  });
  it('classe prudemment un incident non identifié', () => {
    expect(classifyAiFailure(new Error('échec externe'))).toBe('unknown');
  });
});
