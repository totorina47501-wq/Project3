// Capabilities et garde-fous purement déterministes (testables sans réseau).
// Aucun drapeau d'environnement ne doit contenir une clé côté navigateur.
export type OpenAICapability = 'text' | 'vision' | 'audio' | 'embeddings';
export type OpenAIEnv = {
  OPENAI_API_KEY?: string | undefined;
  OPENAI_PAUSED?: string | undefined;
  OPENAI_TEXT_ENABLED?: string | undefined;
  OPENAI_VISION_ENABLED?: string | undefined;
  OPENAI_AUDIO_ENABLED?: string | undefined;
  OPENAI_EMBEDDINGS_ENABLED?: string | undefined;
};

export const OPENAI_MODELS = {
  text: 'gpt-4o',
  vision: 'gpt-4o',
  audio: 'gpt-transcribe',
  embeddings: 'text-embedding-3-small',
} as const;
export const AUDIO_MAX_SECONDS = 60;
export const AUDIO_MAX_BYTES = 3 * 1024 * 1024;
export const EMBEDDING_MAX_CHARACTERS = 5000;
export const EMBEDDING_DIMENSIONS = 1536;
export const MAX_CHAT_COMPLETION_TOKENS = 2500;

export class OpenAICapabilityDisabledError extends Error {
  constructor() {
    super('Cette fonctionnalité OpenAI est désactivée.');
    this.name = 'OpenAICapabilityDisabledError';
  }
}
export class MissingOpenAIKeyError extends Error {
  constructor() {
    super('OPENAI_API_KEY manquante côté serveur.');
    this.name = 'MissingOpenAIKeyError';
  }
}

// Les fonctions texte/vision déjà utilisées restent compatibles tant que
// OPENAI_PAUSED ou leur propre drapeau ne les désactive pas explicitement.
// Audio et embeddings sont désactivés par défaut même avec une clé existante.
export function openaiCapabilityEnabled(capability: OpenAICapability, env: OpenAIEnv): boolean {
  if (env.OPENAI_PAUSED === 'true') return false;
  switch (capability) {
    case 'text': return env.OPENAI_TEXT_ENABLED !== 'false';
    case 'vision': return env.OPENAI_VISION_ENABLED !== 'false';
    case 'audio': return env.OPENAI_AUDIO_ENABLED === 'true';
    case 'embeddings': return env.OPENAI_EMBEDDINGS_ENABLED === 'true';
  }
}
export function assertOpenAIAllowed(capability: OpenAICapability, env: OpenAIEnv): void {
  // Vérifier le flag avant la clé : sans activation, l'API n'est jamais appelée.
  if (!openaiCapabilityEnabled(capability, env))
    throw new OpenAICapabilityDisabledError();
  if (!env.OPENAI_API_KEY?.trim()) throw new MissingOpenAIKeyError();
}
export function openaiReadiness(env: OpenAIEnv) {
  return {
    keyConfigured: Boolean(env.OPENAI_API_KEY?.trim()), // Ne jamais transmettre la valeur.
    paused: env.OPENAI_PAUSED === 'true',
    textEnabled: openaiCapabilityEnabled('text', env),
    visionEnabled: openaiCapabilityEnabled('vision', env),
    audioEnabled: openaiCapabilityEnabled('audio', env),
    embeddingsEnabled: openaiCapabilityEnabled('embeddings', env),
    modelText: OPENAI_MODELS.text,
    modelAudio: OPENAI_MODELS.audio,
    modelEmbeddings: OPENAI_MODELS.embeddings,
  };
}
// Prix officiels consultés en novembre 2026, estimation sans remise, sans cache.
// Seul un relevé de facturation OpenAI constitue le total réellement facturé.
export function estimateChatCostUsd(promptTokens: number, outputTokens: number): number {
  const safeInput = Number.isFinite(promptTokens) && promptTokens > 0 ? promptTokens : 0;
  const safeOutput = Number.isFinite(outputTokens) && outputTokens > 0 ? outputTokens : 0;
  return Number(((safeInput * 2.5 + safeOutput * 10) / 1_000_000).toFixed(8));
}
export function estimateAudioCostUsd(durationSeconds: number): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 ||
      durationSeconds > AUDIO_MAX_SECONDS)
    throw new Error('Durée audio hors limites.');
  return Number((durationSeconds / 60 * 0.0045).toFixed(8));
}
export function estimateEmbeddingCostUsd(tokens: number): number {
  if (!Number.isInteger(tokens) || tokens < 0) throw new Error('Tokens non valides.');
  return Number((tokens * 0.02 / 1_000_000).toFixed(8));
}
