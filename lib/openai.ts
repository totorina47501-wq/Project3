// Chemin : lib/openai.ts
import 'server-only';
import OpenAI from 'openai';
import { z } from 'zod';
import type { ModelTelemetry } from '@/lib/ai/schemas';

const MODEL = 'gpt-4o';

function client() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY manquante.');
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 30000,
    maxRetries: 2,
  });
}

function telemetry(
  usage: { prompt_tokens?: number; completion_tokens?: number } | null | undefined,
  started: number,
): ModelTelemetry {
  const promptTokens = usage?.prompt_tokens ?? 0;
  const completionTokens = usage?.completion_tokens ?? 0;
  return {
    model: MODEL,
    promptTokens,
    completionTokens,
    latencyMs: Date.now() - started,
    // Estimation tarifaire pour le reporting, à actualiser avec les prix contractuels.
    estimatedCostUsd: Number(
      ((promptTokens * 5 + completionTokens * 15) / 1000000).toFixed(8),
    ),
  };
}

async function complete<T>(
  system: string,
  user: string | OpenAI.Chat.Completions.ChatCompletionContentPart[],
  schema: z.ZodType<T>,
): Promise<{ value: T; usage: ModelTelemetry }> {
  const started = Date.now();
  const completion = await client().chat.completions.create({
    model: MODEL,
    store: false,
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });
  const raw = completion.choices[0]?.message.content;
  if (!raw) throw new Error('Réponse OpenAI vide.');
  return {
    value: schema.parse(JSON.parse(raw)),
    usage: telemetry(completion.usage, started),
  };
}

export function chatText<T>(system: string, content: string, schema: z.ZodType<T>) {
  return complete(system, content, schema);
}

export function chatVision<T>(
  system: string,
  signedImageUrl: string,
  schema: z.ZodType<T>,
) {
  return complete(system, [
    { type: 'text', text: 'Analyse ce visuel conformément au format JSON demandé.' },
    { type: 'image_url', image_url: { url: signedImageUrl, detail: 'low' } },
  ], schema);
}
