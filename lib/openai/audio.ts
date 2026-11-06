// WAV privé préparé et validé ; aucun appel sans activation et demande explicites.
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
  const started=performance.now();
  const file = await toFile(input.bytes, 'audio.wav', { type: 'audio/wav' });
  const result = await openaiClient('audio').audio.transcriptions.create({
    model: OPENAI_MODELS.audio,
    file,
  });
  const reported=result.usage?.type==='tokens'?result.usage:null;
  return {
    text: result.text.trim().slice(0, 12_000),
    model: OPENAI_MODELS.audio,
    durationSeconds: input.durationSeconds,
    estimatedCostUsd: estimateAudioCostUsd(input.durationSeconds),
    tokenCountsReported:Boolean(reported),
    usage:{model:OPENAI_MODELS.audio,promptTokens:reported?.input_tokens??0,
      completionTokens:reported?.output_tokens??0,latencyMs:Math.round(performance.now()-started),
      estimatedCostUsd:estimateAudioCostUsd(input.durationSeconds)},
  };
}
