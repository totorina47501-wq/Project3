'use client';
import { useState } from 'react';

type Status = { total: number; indexed: number; enabled: boolean; error?: string };
export function MiaIndexAdmin() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function refresh() {
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/admin/mia-index', { cache: 'no-store' });
      const data: Status = await res.json();
      if (!res.ok) throw new Error(data.error || 'État indisponible.');
      setStatus(data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur inconnue.'); }
    finally { setBusy(false); }
  }
  async function run() {
    if (!window.confirm('Indexer les documents manquants ? Cette opération utilise des crédits OpenAI.')) return;
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/admin/mia-index', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'INDEXER-5' }) });
      const data: { error?: string; verified?: boolean } = await res.json();
      if (!res.ok) throw new Error(data.error || 'Indexation impossible.');
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur inconnue.'); }
    finally { setBusy(false); }
  }
  return <section className="rounded-2xl border border-slate-200 bg-white p-6">
    <h2 className="font-heading text-xl font-bold">Administration Mia — documents juridiques</h2>
    <p className="mt-2 text-sm text-slate-600">Indexation réservée à l’administrateur. L’état est lu sans appel OpenAI.</p>
    <p className="mt-3" aria-live="polite">{status ? `${status.indexed} / ${status.total} documents indexés — OpenAI ${status.enabled ? 'autorisé' : 'désactivé'}` : 'État non chargé'}</p>
    {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
    <div className="mt-4 flex flex-wrap gap-3">
      <button type="button" disabled={busy} onClick={refresh} className="rounded-lg border px-4 py-2 disabled:opacity-50">Actualiser</button>
      <button type="button" disabled={busy || !status?.enabled || status.total === 0 || status.indexed >= status.total}
        onClick={run} className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50">Indexer le prochain lot (5 maximum)</button>
    </div>
  </section>;
}
