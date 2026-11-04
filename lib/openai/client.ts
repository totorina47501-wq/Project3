// Client serveur partagé. Les nouvelles capacités sont fermées par défaut.
import 'server-only';
import OpenAI from 'openai';
import { assertOpenAIAllowed, type OpenAICapability } from '@/lib/openai/config';

export function openaiClient(capability: OpenAICapability): OpenAI {
  assertOpenAIAllowed(capability, process.env);
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 30_000,
    // Pas de nouvelle tentative automatique d'une requête potentiellement facturée.
    maxRetries: 0,
  });
}
