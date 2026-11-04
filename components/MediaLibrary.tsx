// Préparation privée des vidéos et des carrousels, sans aucun appel IA.
'use client';
import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { MAX_CAROUSEL_IMAGES, MAX_VIDEO_DURATION_SECONDS,
  mediaPrepareSchema, isVideo } from '@/lib/media/validation';
import { uploadPreparedFile, readVideoDuration,
  type PreparedUpload } from '@/lib/media/browser-upload';

type Item = {
  id: string; group_id: string | null; kind: 'image'|'video';
  status: 'pending'|'ready'; mime_type: string; declared_bytes: number;
  duration_seconds: number | null; created_at: string; expires_at: string;
};
type PrepareResult = PreparedUpload & { error?: string };
type ItemsResult = { items?: Item[]; error?: string };

export function MediaLibrary() {
  const [items, setItems] = useState<Item[]>([]);
  const [mode, setMode] = useState<'video'|'carousel'>('video');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const response = await fetch('/api/media/library', { cache: 'no-store' });
    const data = await response.json() as ItemsResult;
    if (!response.ok) throw new Error(data.error ?? 'Liste indisponible.');
    setItems(data.items ?? []);
  }, []);
  useEffect(() => {
    void refresh().catch(() => setError('Impossible de charger les médias privés.'));
  }, [refresh]);

  async function post<T>(path: string, payload: unknown): Promise<T> {
    const response = await fetch(path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json() as T & { error?: string };
    if (!response.ok) throw new Error(result.error ?? 'Opération indisponible.');
    return result;
  }

  async function uploadFiles(files: File[]) {
    if (busy || files.length === 0) return;
    setError(''); setNotice(''); setProgress(0);
    setBusy(true);
    try {
      if (mode === 'video' && files.length !== 1) throw new Error('Choisis une seule vidéo.');
      if (mode === 'carousel' && (files.length > MAX_CAROUSEL_IMAGES || files.length < 2))
        throw new Error('Un carrousel comporte de deux à cinq images.');
      const groupId = mode === 'carousel' ? crypto.randomUUID() : undefined;
      for (let index=0; index<files.length; index++) {
        const file = files[index];
        if (!file) continue;
        const durationSeconds = isVideo(file.type) ? await readVideoDuration(file) : undefined;
        if (durationSeconds && durationSeconds > MAX_VIDEO_DURATION_SECONDS)
          throw new Error('Vidéo trop longue : maximum 60 secondes.');
        const input = {
          mime: file.type, size: file.size,
          ...(durationSeconds ? { durationSeconds } : {}),
          ...(groupId ? { groupId } : {}),
        };
        if (!mediaPrepareSchema.safeParse(input).success)
          throw new Error('Média refusé : type, taille ou durée dépassée.');
        const prepared = await post<PrepareResult>('/api/media/prepare', input);
        await uploadPreparedFile(file, prepared,
          (ratio) => setProgress(Math.round(((index + ratio / 100) / files.length) * 100)));
        await post('/api/media/complete', { assetId: prepared.assetId });
      }
      setNotice(mode === 'video'
        ? 'Vidéo conservée en privé. La transcription et l’analyse IA ne sont pas lancées.'
        : 'Carrousel privé enregistré. Aucune analyse IA ni dépense OpenAI.');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Échec du téléversement.');
      await refresh().catch(() => {});
    } finally { setBusy(false); }
  }

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.currentTarget.value = '';
    void uploadFiles(files);
  }

  async function remove(id: string) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await post('/api/media/remove', { assetId: id });
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Suppression impossible.');
    } finally { setBusy(false); }
  }

  return <div className="space-y-6">
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
      <h2 className="font-heading text-xl font-bold">Préparer mes médias</h2>
      <p className="mt-2 text-sm text-slate-700">
        Tes fichiers sont envoyés directement vers ton espace privé Supabase.
        Aucun GPT-4o, Whisper ni autre appel IA n&apos;est effectué ici.
      </p>
      <p className="mt-2 text-sm text-slate-600">
        Les vidéos sont conservées temporairement, mais leur conformité n&apos;est pas encore
        analysée. La durée doit aussi être recontrôlée côté serveur lors du futur traitement vidéo.
      </p>
      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Choisir le type de média">
        <button type="button" aria-pressed={mode === 'video'} disabled={busy}
          onClick={() => setMode('video')}
          className={'rounded-xl px-4 py-2 text-sm font-bold ' +
            (mode === 'video' ? 'bg-indigo-600 text-white' : 'border border-indigo-300 bg-white')}>
          Vidéo courte
        </button>
        <button type="button" aria-pressed={mode === 'carousel'} disabled={busy}
          onClick={() => setMode('carousel')}
          className={'rounded-xl px-4 py-2 text-sm font-bold ' +
            (mode === 'carousel' ? 'bg-indigo-600 text-white' : 'border border-indigo-300 bg-white')}>
          Carrousel
        </button>
      </div>
      <label className="mt-5 block font-semibold" htmlFor="media-preparation-file">
        {mode === 'video' ? 'Vidéo MP4 ou MOV, 60 s et 50 Mo maximum'
          : 'Deux à cinq images JPEG, PNG ou WebP, 8 Mo maximum chacune'}
      </label>
      <input id="media-preparation-file" type="file" disabled={busy}
        accept={mode === 'video' ? 'video/mp4,video/quicktime'
          : 'image/jpeg,image/png,image/webp'}
        multiple={mode === 'carousel'} onChange={handleFiles}
        className="mt-2 block w-full text-sm" />
      {busy && <div role="status" className="mt-4">
        <p className="text-sm font-semibold">Téléversement en cours : {progress} %</p>
        <progress className="mt-2 w-full" value={progress} max={100} />
      </div>}
      {notice && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <p className="mt-3 text-xs text-slate-500">
        Le stockage Supabase peut générer des frais selon ton abonnement, mais ne consomme aucun crédit OpenAI.
      </p>
    </div>

    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-heading text-xl font-bold">Fichiers préparés</h2>
      {!items.length && <p className="mt-3 text-sm text-slate-500">Aucun média enregistré.</p>}
      <ul className="mt-4 space-y-3">
        {items.map((item) => <li key={item.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4">
          <div className="min-w-0">
            <p className="font-semibold">{item.kind === 'video' ? 'Vidéo privée' : 'Image privée'}
              {item.group_id ? ' · Carrousel' : ''}</p>
            <p className="mt-1 text-xs text-slate-600">
              {Math.round(item.declared_bytes / 1024)} Ko · {item.status === 'ready'
                ? 'Transféré' : 'Transfert non confirmé'} ·
              expire le {new Date(item.expires_at).toLocaleDateString('fr-FR')}
            </p>
          </div>
          <button type="button" disabled={busy} onClick={() => void remove(item.id)}
            className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-red-700 disabled:opacity-50">
            Supprimer
          </button>
        </li>)}
      </ul>
    </section>
  </div>;
}
