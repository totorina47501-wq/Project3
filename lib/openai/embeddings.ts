// Préparation pgvector : volontairement non raccordée à la recherche Mia
// tant que les crédits d'embeddings sont suspendus.
import 'server-only';
import { openaiClient } from '@/lib/openai/client';
import { validateEmbeddingText, validateEmbeddingVector } from '@/lib/openai/validation';
import {
  assertOpenAIAllowed, EMBEDDING_DIMENSIONS, OPENAI_MODELS, estimateEmbeddingCostUsd,
} from '@/lib/openai/config';

export async function generateLegalEmbedding(text: string) {
  assertOpenAIAllowed('embeddings', process.env);
  const input = validateEmbeddingText(text);
  const response = await openaiClient('embeddings').embeddings.create({
    model: OPENAI_MODELS.embeddings,
    input,
    dimensions: EMBEDDING_DIMENSIONS,
  });
  const vector = response.data[0]?.embedding;
  if (!vector) throw new Error('Aucun vecteur généré.');
  validateEmbeddingVector(vector);
  return {
    vector, model: OPENAI_MODELS.embeddings,
    tokens: response.usage.total_tokens,
    estimatedCostUsd: estimateEmbeddingCostUsd(response.usage.total_tokens),
  };
}
