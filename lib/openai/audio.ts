// Adaptateur audio seulement ; aucun appel sans activation explicite.
// Le branchement à un véritable service vidéo et la validation de la
// demande utilisateur sont à réaliser dans un lot ultérieur.
import 'server-only';
import { toFile } from 'openai';
import { openaiClient } from '@/lib/openai/client';
import { validatePreparedAudio, type AudioPreparation } from '@/lib/openai/validation';
import {
  assertOpenAIAllowed, OPENAI_MODELS, estimateAudioCostUsd,
} from '@/lib/openai/config';

export async function transcribePreparedAudio(input: AudioPreparation) {
  // Ordre déterministe : la désactivation évite également tout Uploadable SDK.
  assertOpenAIAllowed('audio', process.env);
  validatePreparedAudio(input);
  const file = await toFile(input.bytes, 'audio.wav', { type: 'audio/wav' });
  const result = await openaiClient('audio').audio.transcriptions.create({
    model: OPENAI_MODELS.audio,
    file,
  });
  return {
    text: result.text.trim().slice(0, 12_000),
    model: OPENAI_MODELS.audio,
    durationSeconds: input.durationSeconds,
    estimatedCostUsd: estimateAudioCostUsd(input.durationSeconds),
  };
}
