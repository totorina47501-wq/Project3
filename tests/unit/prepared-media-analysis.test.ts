import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { loadPreparedAnalysis } from '@/lib/media/prepared-analysis';

const userId = '11111111-1111-4111-8111-111111111111';
const jobId = '22222222-2222-4222-8222-222222222222';
const attemptId = '33333333-3333-4333-8333-333333333333';
const assetId = '44444444-4444-4444-8444-444444444444';
const prefix = `${userId}/${jobId}/${attemptId}`;
const hash = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const jpeg = new Uint8Array([255, 216, 255, 224, 0, 1, 255, 217]);
const webp = new TextEncoder().encode('RIFF0000WEBPfixture');
const wav = new Uint8Array(44);
wav.set(new TextEncoder().encode('RIFF'));
wav.set(new TextEncoder().encode('WAVE'), 8);

function fixture(kind: 'video' | 'carousel' = 'video', hasAudio = true, slidesCount = 2) {
  const inputs = (kind === 'video' ? ['mp4'] : Array.from({ length: slidesCount }, () => 'webp')).map((extension, index) => ({
    path: `${userId}/${index === 0 ? assetId : `55555555-5555-4555-8555-55555555555${index}`}.${extension}`,
    sha256: hash(`source-${index}`), bytes: 100, snapshot: `${index + 1}.${extension}`,
  }));
  const files = new Map<string, Uint8Array>();
  const artifact = (name: string, bytes: Uint8Array) => {
    files.set(`${prefix}/${name}`, bytes);
    return { name, bytes: bytes.byteLength, sha256: hash(bytes) };
  };
  const images = Array.from({ length: kind === 'video' ? 3 : slidesCount }, (_, index) => artifact(
    kind === 'video' ? `frame-0${index + 1}.jpg` : `slide-0${index + 1}.webp`,
    kind === 'video' ? jpeg : webp,
  ));
  const audio = kind === 'video' && hasAudio ? artifact('audio-mono.wav', wav) : null;
  const manifest = kind === 'video' ? {
    schemaVersion: 2, aiCalls: 0,
    video: { durationSeconds: 1, hasAudio, sha256: inputs[0]!.sha256, width: 640, height: 360, codec: 'h264' },
    frames: images.map((item, index) => ({ ...item, atSeconds: [0.15, 0.5, 0.85][index] })), audio,
  } : {
    schemaVersion: 1, processor: 'mentioncheck-carousel-offline-v1', aiCalls: 0,
    slides: images.map((item, index) => ({
      position: index + 1, sourceSha256: inputs[index]!.sha256,
      sourceWidth: 640, sourceHeight: 360,
      outputFile: item.name, outputSha256: item.sha256, outputBytes: item.bytes,
    })),
  };
  const artifacts = [...images, ...(audio ? [audio] : []), artifact('manifest.json', new TextEncoder().encode(JSON.stringify(manifest)))];
  const result = {
    schemaVersion: 1, processor: 'mentioncheck-local-media-v1', id: jobId,
    kind, state: 'completed', aiCalls: 0, inputs, artifacts,
    fingerprint: hash(JSON.stringify({ revision: 'mentioncheck-local-media-v1', kind,
      inputs: inputs.map(({ path, sha256, bytes }) => ({ path, sha256, bytes })) })),
    delivery: { bucket: 'verification-media-derived', prefix },
  };
  const download = vi.fn(async (path: string) => {
    const bytes = files.get(path);
    if (!bytes) throw new Error('Absent');
    return bytes;
  });
  return { result, files, download, manifest };
}

describe('artefacts privés préparés avant analyse IA', () => {
  it('charge les trois frames, le manifeste et le WAV en vérifiant leurs empreintes', async () => {
    const { result, download } = fixture();
    const loaded = await loadPreparedAnalysis({ userId, jobId, kind: 'video', result, includeAudio: true }, download);
    expect(loaded.images).toHaveLength(3);
    expect(loaded.images[0]?.dataUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(loaded.audio).toEqual({ bytes: wav, durationSeconds: 1 });
    expect(loaded.evidence).toHaveLength(5);
    expect(loaded.warnings.join(' ')).toMatch(/trois images|3 images|3 frames/i);
    expect(download).toHaveBeenCalledTimes(5);
  });

  it('charge toutes les diapositives ordonnées sans audio', async () => {
    const { result, download } = fixture('carousel');
    const loaded = await loadPreparedAnalysis({ userId, jobId, kind: 'carousel', result, includeAudio: false }, download);
    expect(loaded.images.map(image => image.name)).toEqual(['slide-01.webp', 'slide-02.webp']);
    expect(loaded.images[0]?.dataUrl).toMatch(/^data:image\/webp;base64,/);
    expect(loaded.audio).toBeUndefined();
    expect(loaded.evidence).toHaveLength(3);
  });

  it('ne télécharge pas un audio non demandé et signale la couverture partielle', async () => {
    const { result, download } = fixture();
    const loaded = await loadPreparedAnalysis({ userId, jobId, kind: 'video', result, includeAudio: false }, download);
    expect(loaded.audio).toBeUndefined();
    expect(download).not.toHaveBeenCalledWith(`${prefix}/audio-mono.wav`);
    expect(loaded.warnings.join(' ')).toMatch(/audio.*pas analys|audio.*non analys/i);
  });

  it('signale une vidéo sans piste audio sans inventer de transcription', async () => {
    const { result, download } = fixture('video', false);
    const loaded = await loadPreparedAnalysis({ userId, jobId, kind: 'video', result, includeAudio: true }, download);
    expect(loaded.audio).toBeUndefined();
    expect(loaded.warnings.join(' ')).toMatch(/aucune piste audio/i);
  });

  it.each([
    ['chemin traversant', (result: ReturnType<typeof fixture>['result']) => { result.artifacts[0]!.name = '../frame-01.jpg'; }],
    ['autre propriétaire', (result: ReturnType<typeof fixture>['result']) => { result.delivery.prefix = prefix.replace(userId, attemptId); }],
    ['bucket arbitraire', (result: ReturnType<typeof fixture>['result']) => { result.delivery.bucket = 'public'; }],
    ['préfixe avec chemin supplémentaire', (result: ReturnType<typeof fixture>['result']) => { result.delivery.prefix += '/extra'; }],
    ['autre tâche', (result: ReturnType<typeof fixture>['result']) => { result.id = attemptId; }],
    ['non terminé', (result: ReturnType<typeof fixture>['result']) => { result.state = 'processing'; }],
    ['taille annoncée excessive', (result: ReturnType<typeof fixture>['result']) => { result.artifacts[0]!.bytes = 2 * 1024 * 1024; }],
    ['artefact dupliqué', (result: ReturnType<typeof fixture>['result']) => { result.artifacts.push(result.artifacts[0]!); }],
    ['source autre propriétaire', (result: ReturnType<typeof fixture>['result']) => { result.inputs[0]!.path = `${attemptId}/${assetId}.mp4`; }],
    ['empreinte de source modifiée', (result: ReturnType<typeof fixture>['result']) => { result.inputs[0]!.sha256 = hash('autre source'); }],
  ])('refuse avant tout téléchargement : %s', async (_, mutate) => {
    const { result, download } = fixture();
    mutate(result);
    await expect(loadPreparedAnalysis({ userId, jobId, kind: 'video', result, includeAudio: true }, download)).rejects.toThrow();
    expect(download).not.toHaveBeenCalled();
  });

  it('refuse un carrousel incomplet', async () => {
    const { result, download } = fixture('carousel');
    result.artifacts.splice(1, 1);
    await expect(loadPreparedAnalysis({ userId, jobId, kind: 'carousel', result, includeAudio: false }, download)).rejects.toThrow();
  });

  it('refuse le dépassement du budget cumulé des images avant téléchargement', async () => {
    const { result, download } = fixture('carousel', false, 5);
    for (const artifact of result.artifacts) {
      if (artifact.name.endsWith('.webp')) artifact.bytes = 1.2 * 1024 * 1024 | 0;
    }
    await expect(loadPreparedAnalysis({ userId, jobId, kind: 'carousel', result, includeAudio: false }, download)).rejects.toThrow();
    expect(download).not.toHaveBeenCalled();
  });

  it('ne divulgue pas le message du transport privé', async () => {
    const { result } = fixture();
    await expect(loadPreparedAnalysis({ userId, jobId, kind: 'video', result, includeAudio: false },
      async () => { throw new Error('service_role=cle-privee'); },
    )).rejects.toThrow('Les fichiers privés sont momentanément indisponibles.');
  });

  it.each(['frame-02.jpg', 'manifest.json', 'audio-mono.wav'])('refuse les octets altérés : %s', async name => {
    const { result, files, download } = fixture();
    files.set(`${prefix}/${name}`, new Uint8Array([1, 2, 3]));
    await expect(loadPreparedAnalysis({ userId, jobId, kind: 'video', result, includeAudio: true }, download)).rejects.toThrow();
  });

  it('refuse un manifeste valide en hash mais incohérent avec les sorties', async () => {
    const { result, files, download, manifest } = fixture();
    if ('frames' in manifest) manifest.frames[0]!.sha256 = hash('autre image');
    const bytes = new TextEncoder().encode(JSON.stringify(manifest));
    files.set(`${prefix}/manifest.json`, bytes);
    Object.assign(result.artifacts.find(item => item.name === 'manifest.json')!, { bytes: bytes.length, sha256: hash(bytes) });
    await expect(loadPreparedAnalysis({ userId, jobId, kind: 'video', result, includeAudio: true }, download)).rejects.toThrow();
  });

  it('refuse un hash valide pour un faux en-tête JPEG', async () => {
    const { result, files, download, manifest } = fixture();
    const bytes = new Uint8Array([1, 2, 3, 4]);
    files.set(`${prefix}/frame-01.jpg`, bytes);
    Object.assign(result.artifacts[0]!, { bytes: bytes.length, sha256: hash(bytes) });
    if ('frames' in manifest) Object.assign(manifest.frames[0]!, result.artifacts[0]);
    const json = new TextEncoder().encode(JSON.stringify(manifest));
    files.set(`${prefix}/manifest.json`, json);
    Object.assign(result.artifacts.find(item => item.name === 'manifest.json')!, { bytes: json.length, sha256: hash(json) });
    await expect(loadPreparedAnalysis({ userId, jobId, kind: 'video', result, includeAudio: true }, download)).rejects.toThrow();
  });
});
