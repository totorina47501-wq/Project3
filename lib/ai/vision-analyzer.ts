// Chemin : lib/ai/vision-analyzer.ts
import { chatVision } from '@/lib/openai';
import { VISION_SYSTEM } from '@/lib/ai/prompts';
import { visionModelSchema, type MediaType } from '@/lib/ai/schemas';
import { HttpError } from '@/lib/security/auth';

export async function analyzeVisual(mediaUrl: string, mediaType: MediaType) {
  if (mediaType !== 'image') {
    // Les vidéos et carrousels demandent une extraction distincte côté worker.
    throw new HttpError(422, 'Analyse vidéo et carrousel en préparation. Utilise une image.');
  }
  const result = await chatVision(VISION_SYSTEM, mediaUrl, visionModelSchema);
  return { ...result.value, usage: result.usage };
}
