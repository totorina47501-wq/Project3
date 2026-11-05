import type { ModelTelemetry } from '@/lib/ai/schemas';
export type OutputFailureKind = 'invalid_json' | 'schema_mismatch' | 'empty' | 'refusal' | 'token_limit';
// Le message et les propriétés ne contiennent jamais la réponse brute du modèle.
export class ModelOutputError extends Error {
  constructor(public readonly kind: OutputFailureKind, public readonly usage: ModelTelemetry) {
    super('La réponse IA ne respecte pas le format attendu.');
    this.name = 'ModelOutputError';
  }
}
