'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
type Asset = { id: string; group_id: string | null; kind: 'image' | 'video'; status: string };
type Job = { id: string; verification_id: string; kind: string; status: 'queued'|'processing'|'completed'|'failed'|'cancelled'; attempts: number; failure_code: string | null };
const labels = { queued: 'En attente', processing: 'Préparation en cours', completed: 'Préparation terminée', failed: 'Échec de préparation', cancelled: 'Annulée' };
export function MediaJobsPanel({ enabled, assets }: { enabled: boolean; assets: Asset[] }) {
  const [caption, setCaption] = useState('');
  const [platform, setPlatform] = useState('instagram');
  const [selected, setSelected] = useState<string[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [offset, setOffset] = useState(0), [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const refresh = useCallback(async () => {
    const response = await fetch(`/api/media/jobs?offset=${offset}`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? 'File indisponible.');
    setJobs(data.jobs ?? []); setTotal(data.total ?? 0);
  }, [offset]);
  useEffect(() => { if (enabled) void refresh().catch(() => setError('Impossible de charger les préparations. Réessaie.')); }, [enabled, refresh]);
  const pending = jobs.some(job => job.status === 'queued' || job.status === 'processing');
  useEffect(() => {
    if (!enabled || !pending) return;
    const timer = setInterval(() => { void refresh().catch(() => setError('Actualisation interrompue. Réessaie.')); }, 5000);
    return () => clearInterval(timer);
  }, [enabled, pending, refresh]);
  async function submit(payload: unknown) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/media/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Préparation indisponible.');
      setNotice(data.cancelled ? 'Préparation annulée.' : data.notice);
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Opération indisponible.'); }
    finally { setBusy(false); }
  }
  if (!enabled) return <section className="rounded-2xl border bg-white p-5" aria-labelledby="jobs-title">
    <h2 id="jobs-title" className="font-heading text-xl font-bold">Préparation et contrôle de la légende</h2>
    <p className="mt-3 text-sm text-slate-600">Le traitement automatique des médias est désactivé. Tes fichiers privés ne sont pas envoyés à un modèle IA.</p>
  </section>;
  const ready = assets.filter(asset => asset.status === 'ready');
  return <section className="space-y-4 rounded-2xl border bg-white p-5" aria-labelledby="jobs-title" aria-busy={busy}>
    <h2 id="jobs-title" className="font-heading text-xl font-bold">Préparation et contrôle de la légende</h2>
    <p className="text-sm text-slate-600">Choisis une vidéo ou de deux à cinq images du même carrousel. La légende sera contrôlée par les règles automatiques. Les images et l’audio seront préparés sans analyse IA ni transcription.</p>
    <form className="space-y-3" onSubmit={event => { event.preventDefault(); void submit({ action: 'enqueue', assetIds: selected, caption, platform }); }}>
      <fieldset disabled={busy} className="space-y-2"><legend className="font-semibold">Médias confirmés</legend>
        {!ready.length && <p className="text-sm text-slate-500">Téléverse d’abord tes médias dans la bibliothèque.</p>}
        {ready.map(asset => <label key={asset.id} className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={selected.includes(asset.id)} onChange={event => setSelected(current => event.target.checked ? [...current, asset.id] : current.filter(id => id !== asset.id))} />
          {asset.kind === 'video' ? 'Vidéo' : 'Image'} {asset.id.slice(0, 8)}{asset.group_id ? ` · carrousel ${asset.group_id.slice(0, 8)}` : ''}
        </label>)}
      </fieldset>
      <label className="block font-semibold" htmlFor="media-job-caption">Légende à contrôler</label>
      <textarea id="media-job-caption" required maxLength={10000} rows={4} value={caption} disabled={busy} onChange={event => setCaption(event.target.value)} className="w-full rounded-lg border p-3" />
      <label className="block font-semibold" htmlFor="media-job-platform">Plateforme</label>
      <select id="media-job-platform" value={platform} disabled={busy} onChange={event => setPlatform(event.target.value)} className="rounded-lg border p-2">
        <option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="youtube">YouTube</option><option value="linkedin">LinkedIn</option>
      </select>
      <button type="submit" disabled={busy || !caption.trim() || selected.length < 1 || selected.length > 5} className="ml-3 rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-50">Préparer et contrôler la légende</button>
    </form>
    {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm">{notice}</p>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <button type="button" disabled={busy} onClick={() => { setError(''); void refresh().catch(() => setError('Actualisation impossible. Réessaie.')); }} className="rounded-lg border px-3 py-2 text-sm">Actualiser les préparations</button>
    {!jobs.length && <p className="text-sm text-slate-500">Aucune préparation sur cette page.</p>}
    <ul className="space-y-3">{jobs.map(job => <li key={job.id} className="rounded-lg bg-slate-50 p-3">
      <p className="font-semibold">{job.kind === 'video' ? 'Vidéo' : 'Carrousel'} · {labels[job.status]}</p>
      <p className="text-xs text-slate-600">Tentatives : {job.attempts}/3</p>
      {job.status === 'failed' && <p className="text-sm text-red-700">Le média n’a pas pu être préparé. Vérifie son format et sa durée ; aucun résultat IA n’a été produit.</p>}
      {job.status === 'completed' && <p className="mt-2 text-sm">Contrôle textuel et empreintes archivés. <Link href={'/dashboard/archive/' + job.verification_id} className="underline">Consulter ce contrôle</Link></p>}
      {['queued','processing'].includes(job.status) && <button type="button" disabled={busy} onClick={() => void submit({ action: 'cancel', jobId: job.id })} className="mt-2 rounded-lg border px-3 py-2 text-sm">Annuler la préparation</button>}
    </li>)}</ul>
    <div className="flex items-center justify-between text-sm"><button type="button" disabled={offset === 0 || busy} onClick={() => setOffset(Math.max(0, offset - 20))}>Précédent</button><span>{total} préparation(s)</span><button type="button" disabled={offset + 20 >= total || busy} onClick={() => setOffset(offset + 20)}>Suivant</button></div>
  </section>;
}
