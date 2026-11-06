// Lecture bornée des sorties privées ; aucune URL externe ni API IA dans ce module.
import { Buffer } from 'node:buffer';
import { z } from 'zod';
import { validatePreparedAudio, type AudioPreparation } from '@/lib/openai/validation';

const MIB = 1024 * 1024;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const HEX = /^[a-f0-9]{64}$/;
const REVISION = 'mentioncheck-local-media-v1';
const imageLimit = 1.5 * MIB;
const totalImageLimit = 5 * MIB;
const artifactSchema = z.object({
  name: z.string().regex(/^(?:frame-0[1-3]\.jpg|slide-0[1-5]\.webp|audio-mono\.wav|manifest\.json)$/),
  sha256: z.string().regex(HEX), bytes: z.number().int().positive().max(3 * MIB),
}).strict();
const resultSchema = z.object({
  schemaVersion: z.literal(1), processor: z.literal(REVISION),
  id: z.string().regex(UUID), kind: z.enum(['video', 'carousel']),
  state: z.literal('completed'), aiCalls: z.literal(0),
  fingerprint: z.string().regex(HEX),
  inputs: z.array(z.object({
    path: z.string().max(150), sha256: z.string().regex(HEX),
    bytes: z.number().int().positive().max(50 * MIB),
    snapshot: z.string().regex(/^[1-5]\.(?:mp4|mov|jpg|jpeg|png|webp)$/).optional(),
  }).strict()).min(1).max(5),
  artifacts: z.array(artifactSchema).min(3).max(7),
  delivery: z.object({ bucket: z.literal('verification-media-derived'), prefix: z.string().max(110) }).strict(),
  notice: z.string().max(300).optional(),
}).strict();

export type PreparedEvidence = { name: string; sha256: string; bytes: number };
export type PreparedAnalysis = {
  images: { name: string; dataUrl: string }[];
  audio?: AudioPreparation;
  evidence: PreparedEvidence[];
  warnings: string[];
};
export type PreparedAnalysisInput = {
  userId: string; jobId: string; kind: 'video' | 'carousel';
  result: unknown; includeAudio: boolean;
};
type Download = (path: string) => Promise<Uint8Array>;
type ObjectValue = Record<string, unknown>;

function invalid(): never {
  throw new Error('Les fichiers préparés sont incomplets, altérés ou hors limites. Prépare à nouveau le média.');
}
function object(value: unknown): ObjectValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  return value as ObjectValue;
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) invalid();
  return value;
}
function positive(value: unknown, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > max) invalid();
  return value;
}
async function sha256(bytes: Uint8Array): Promise<string> {
  // Copier dans un ArrayBuffer propre, également accepté par le Web Crypto de Workers.
  const buffer = new Uint8Array(bytes.byteLength);
  buffer.set(bytes);
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
function starts(bytes: Uint8Array, offset: number, signature: string): boolean {
  return Array.from(signature).every((character, index) => bytes[offset + index] === character.charCodeAt(0));
}

export async function loadPreparedAnalysis(input: PreparedAnalysisInput, download: Download): Promise<PreparedAnalysis> {
  const parsed = resultSchema.safeParse(input.result);
  if (!parsed.success || !UUID.test(input.userId) || !UUID.test(input.jobId)) invalid();
  const result = parsed.data;
  if (result.id !== input.jobId || result.kind !== input.kind) invalid();
  const prefixParts = result.delivery.prefix.split('/');
  if (prefixParts.length !== 3 || prefixParts[0] !== input.userId ||
      prefixParts[1] !== input.jobId || !UUID.test(prefixParts[2] ?? '')) invalid();
  if (input.kind === 'video' ? result.inputs.length !== 1 : result.inputs.length < 2) invalid();
  if (input.kind === 'carousel' && input.includeAudio) invalid();
  const sourcePaths = new Set<string>();
  for (const source of result.inputs) {
    const parts = source.path.split('/');
    const name = parts[1] ?? '';
    const dot = name.lastIndexOf('.');
    const extension = name.slice(dot);
    const allowed = input.kind === 'video' ? ['.mp4', '.mov'] : ['.jpg', '.jpeg', '.png', '.webp'];
    if (parts.length !== 2 || parts[0] !== input.userId || !UUID.test(name.slice(0, dot)) ||
        !allowed.includes(extension) || sourcePaths.has(source.path) ||
        source.bytes > (input.kind === 'video' ? 50 : 8) * MIB) invalid();
    sourcePaths.add(source.path);
  }
  // La preuve technique doit porter exactement sur les sources attendues, dans leur ordre.
  const fingerprint = await sha256(new TextEncoder().encode(JSON.stringify({
    revision: REVISION, kind: result.kind,
    inputs: result.inputs.map(({ path, sha256: digest, bytes }) => ({ path, sha256: digest, bytes })),
  })));
  if (fingerprint !== result.fingerprint) invalid();
  const artifacts = new Map<string, PreparedEvidence>();
  let imageBytes = 0;
  for (const artifact of result.artifacts) {
    if (artifacts.has(artifact.name)) invalid();
    const isImage = artifact.name.endsWith('.jpg') || artifact.name.endsWith('.webp');
    if (isImage) {
      imageBytes += artifact.bytes;
      if (artifact.bytes > imageLimit || imageBytes > totalImageLimit) invalid();
    } else if (artifact.name === 'manifest.json' && artifact.bytes > 128 * 1024) invalid();
    artifacts.set(artifact.name, artifact);
  }
  const imageNames = Array.from({ length: input.kind === 'video' ? 3 : result.inputs.length }, (_, index) =>
    input.kind === 'video' ? `frame-0${index + 1}.jpg` : `slide-0${index + 1}.webp`);
  const expectedNames = [...imageNames, 'manifest.json'];
  const hasAudio = artifacts.has('audio-mono.wav');
  if (hasAudio) {
    if (input.kind !== 'video') invalid();
    expectedNames.push('audio-mono.wav');
  }
  if (artifacts.size !== expectedNames.length || expectedNames.some(name => !artifacts.has(name))) invalid();

  const evidence: PreparedEvidence[] = [];
  const read = async (name: string): Promise<Uint8Array> => {
    const artifact = artifacts.get(name);
    if (!artifact) invalid();
    let downloaded: Uint8Array;
    try { downloaded = await download(`${result.delivery.prefix}/${name}`); }
    catch { throw new Error('Les fichiers privés sont momentanément indisponibles.'); }
    if (!(downloaded instanceof Uint8Array) || downloaded.byteLength !== artifact.bytes) invalid();
    // Une copie empêche le fournisseur injecté de modifier les octets après leur contrôle.
    const bytes = new Uint8Array(downloaded);
    if (await sha256(bytes) !== artifact.sha256) invalid();
    evidence.push({ ...artifact });
    return bytes;
  };
  const manifestBytes = await read('manifest.json');
  let rawManifest: unknown;
  try { rawManifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(manifestBytes)) as unknown; }
  catch { invalid(); }
  const manifest = object(rawManifest);
  if (manifest.aiCalls !== 0) invalid();
  let durationSeconds: number | undefined;
  if (input.kind === 'video') {
    const video = object(manifest.video);
    if (manifest.schemaVersion !== 2 || video.sha256 !== result.inputs[0]?.sha256 ||
        typeof video.hasAudio !== 'boolean' || video.hasAudio !== hasAudio ||
        hasAudio !== (manifest.audio !== null && manifest.audio !== undefined)) invalid();
    durationSeconds = positive(video.durationSeconds, 60);
    if (durationSeconds < 0.05) invalid();
    const frames = array(manifest.frames);
    if (frames.length !== 3) invalid();
    let previousTime = -1;
    for (const [index, value] of frames.entries()) {
      const frame = object(value);
      const expected = artifacts.get(imageNames[index] ?? '');
      if (!expected || frame.name !== expected.name || frame.sha256 !== expected.sha256 ||
          frame.bytes !== expected.bytes || typeof frame.atSeconds !== 'number' ||
          !Number.isFinite(frame.atSeconds) || frame.atSeconds < 0 || frame.atSeconds <= previousTime || frame.atSeconds >= durationSeconds) invalid();
      previousTime = frame.atSeconds;
    }
    if (hasAudio) {
      const audio = object(manifest.audio);
      const expected = artifacts.get('audio-mono.wav');
      if (!expected || audio.name !== expected.name || audio.sha256 !== expected.sha256 || audio.bytes !== expected.bytes) invalid();
    }
  } else {
    const slides = array(manifest.slides);
    if (manifest.schemaVersion !== 1 || manifest.processor !== 'mentioncheck-carousel-offline-v1' ||
        slides.length !== result.inputs.length || manifest.audio !== undefined) invalid();
    for (const [index, value] of slides.entries()) {
      const slide = object(value);
      const expected = artifacts.get(imageNames[index] ?? '');
      if (!expected || slide.position !== index + 1 || slide.sourceSha256 !== result.inputs[index]?.sha256 ||
          slide.outputFile !== expected.name || slide.outputSha256 !== expected.sha256 || slide.outputBytes !== expected.bytes) invalid();
    }
  }

  const images: PreparedAnalysis['images'] = [];
  for (const name of imageNames) {
    const bytes = await read(name);
    const isJpeg = name.endsWith('.jpg');
    if (isJpeg ? bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255
      : !starts(bytes, 0, 'RIFF') || !starts(bytes, 8, 'WEBP')) invalid();
    images.push({ name, dataUrl: `data:image/${isJpeg ? 'jpeg' : 'webp'};base64,${Buffer.from(bytes).toString('base64')}` });
  }
  const warnings: string[] = [];
  if (input.kind === 'video') {
    warnings.push('Trois images de la vidéo sont analysées : elles ne permettent pas de vérifier la présence continue des mentions pendant toute la vidéo.');
    if (hasAudio && !input.includeAudio) warnings.push('La piste audio n’est pas analysée pour cette vérification.');
    if (!hasAudio && input.includeAudio) warnings.push('Aucune piste audio n’est présente dans cette vidéo.');
  }
  if (input.includeAudio && hasAudio && durationSeconds !== undefined) {
    const audio = { bytes: await read('audio-mono.wav'), durationSeconds };
    validatePreparedAudio(audio);
    return { images, audio, evidence, warnings };
  }
  return { images, evidence, warnings };
}
