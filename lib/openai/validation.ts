// Validation pure et synchrone, utilisable dans les tests sans API ou SDK.
import {
  AUDIO_MAX_BYTES, AUDIO_MAX_SECONDS, EMBEDDING_DIMENSIONS,
  EMBEDDING_MAX_CHARACTERS,
} from './config';

export type AudioPreparation = { bytes: Uint8Array; durationSeconds: number };

export function validatePreparedAudio(input: AudioPreparation): void {
  if (!Number.isFinite(input.durationSeconds) ||
      input.durationSeconds <= 0 || input.durationSeconds > AUDIO_MAX_SECONDS)
    throw new Error('Durée WAV supérieure à 60 secondes ou invalide.');
  if (!(input.bytes instanceof Uint8Array) ||
      input.bytes.byteLength < 44 || input.bytes.byteLength > AUDIO_MAX_BYTES)
    throw new Error('Le WAV préparé doit avoir une taille comprise entre 44 octets et 3 Mio.');
  const header = (start: number, text: string) => [...text].every(
    (char, i) => input.bytes[start + i] === char.charCodeAt(0),
  );
  if (!header(0,'RIFF') || !header(8,'WAVE'))
    throw new Error('En-tête WAV invalide.');
}

export function validateEmbeddingText(text: string): string {
  const value = text.trim();
  if (value.length < 3 || value.length > EMBEDDING_MAX_CHARACTERS)
    throw new Error('Texte d’embedding : 3 à 5 000 caractères.');
  return value;
}
export function validateEmbeddingVector(vector: number[]): void {
  if (vector.length !== EMBEDDING_DIMENSIONS || !vector.every(Number.isFinite))
    throw new Error('Vecteur d’embedding invalide : 1536 dimensions attendues.');
}
