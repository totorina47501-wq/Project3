// Téléversements directs Supabase (jamais via Cloudflare Worker, jamais via OpenAI).
'use client';
import { Upload } from 'tus-js-client';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import { isVideo } from '@/lib/media/validation';

const CHUNK_SIZE = 6 * 1024 * 1024;
export type PreparedUpload = { assetId: string; path: string; token: string; kind: 'image'|'video' };

export async function uploadPreparedFile(
  file: File, prepared: PreparedUpload, onProgress: (ratio: number) => void,
) {
  if (file.size <= CHUNK_SIZE) {
    const { error } = await createBrowserSupabase()
      .storage.from('verification-media')
      .uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type });
    if (error) throw new Error('Transfert du média privé impossible.');
    onProgress(100);
    return;
  }
  // TUS est préférable pour les vidéos >6 Mo et sur connexion mobile instable.
  // Le jeton signé est transmis à Supabase Storage, jamais à un service tiers.
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname;
  const projectId = host.split('.')[0];
  if (!/^[a-z0-9-]+$/.test(projectId ?? '') || !host.endsWith('.supabase.co'))
    throw new Error('Stockage Supabase non configuré.');

  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: 'https://' + projectId + '.storage.supabase.co/storage/v1/upload/resumable',
      chunkSize: CHUNK_SIZE,
      retryDelays: [0, 3000, 5000, 10000],
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: 'verification-media',
        objectName: prepared.path,
        contentType: file.type,
      },
      headers: { 'x-signature': prepared.token },
      onError: () => reject(new Error('Envoi interrompu : réessaie avec une connexion stable.')),
      onProgress: (sent, total) => onProgress(Math.round((sent / total) * 100)),
      onSuccess: () => resolve(),
    });
    upload.start();
  });
}

export async function readVideoDuration(file: File): Promise<number> {
  if (!isVideo(file.type)) throw new Error('Le fichier choisi n’est pas une vidéo MP4 ou MOV.');
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    return await new Promise<number>((resolve, reject) => {
      const finish = (value: number) => {
        if (!Number.isFinite(value) || value < 0.1) reject(new Error('Durée vidéo non lisible.'));
        else resolve(Math.ceil(value));
      };
      video.onloadedmetadata = () => finish(video.duration);
      video.onerror = () => reject(new Error('Vidéo non prise en charge par ce navigateur.'));
      video.src = url;
      video.load();
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
