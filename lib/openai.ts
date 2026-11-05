// Chemin : lib/openai.ts
import 'server-only';
import type OpenAI from 'openai';
import { openaiClient } from '@/lib/openai/client';
import { estimateChatCostUsd, MAX_CHAT_COMPLETION_TOKENS, OPENAI_MODELS, type OpenAICapability } from '@/lib/openai/config';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import { ModelOutputError } from '@/lib/openai/errors';
import type { ModelTelemetry } from '@/lib/ai/schemas';

const MODEL = OPENAI_MODELS.text;

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
    estimatedCostUsd: estimateChatCostUsd(promptTokens, completionTokens),
  };
}

async function complete<T>(
  system: string,
  user: string | OpenAI.Chat.Completions.ChatCompletionContentPart[],
  schema: z.ZodType<T>,
  capability: Extract<OpenAICapability, 'text' | 'vision'>,
): Promise<{ value: T; usage: ModelTelemetry }> {
  const started = Date.now();
  const completion = await openaiClient(capability).chat.completions.create({
    model: MODEL,
    store: false,
    temperature: 0.1,
    max_completion_tokens: MAX_CHAT_COMPLETION_TOKENS,
    response_format: zodResponseFormat(schema, 'mentioncheck_result'),
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });
  const usage = telemetry(completion.usage, started);
  const choice = completion.choices[0];
  if (choice?.finish_reason === 'length') throw new ModelOutputError('token_limit', usage);
  if (choice?.message.refusal) throw new ModelOutputError('refusal', usage);
  const raw = choice?.message.content;
  if (!raw) throw new ModelOutputError('empty', usage);
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new ModelOutputError('invalid_json', usage); }
  const validated = schema.safeParse(parsed);
  if (!validated.success) throw new ModelOutputError('schema_mismatch', usage);
  return {
    value: validated.data,
    usage,
  };
}

export function chatText<T>(system: string, content: string, schema: z.ZodType<T>) {
  return complete(system, content, schema, 'text');
}

export function chatVision<T>(
  system: string,
  signedImageUrl: string,
  schema: z.ZodType<T>,
) {
  return complete(system, [
    { type: 'text', text: 'Analyse ce visuel conformément au format JSON demandé.' },
    { type: 'image_url', image_url: { url: signedImageUrl, detail: 'low' } },
  ], schema, 'vision');
}
