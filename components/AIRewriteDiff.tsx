// Chemin : components/AIRewriteDiff.tsx
'use client';
import { useState } from 'react';
import type { Rewrite } from '@/lib/ai/schemas';
import { hasClearLeadingDisclosure } from '@/lib/ai/disclosure';

export function AIRewriteDiff({
  rewrite, verificationId,
}: { rewrite: Rewrite; verificationId: string }) {
  const [caption, setCaption] = useState(rewrite.rewrittenCaption);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  async function accept() {
    setMessage('');
    if (!hasClearLeadingDisclosure(caption)) {
      setMessage('Vérifie que la mention « Publicité » ou « Collaboration commerciale » est visible dès le début si cette publication est sponsorisée.');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/rewrite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationId, caption }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Enregistrement impossible.');
      setMessage('Réécriture acceptée et enregistrée.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erreur inattendue.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
      <h3 className="font-heading text-xl font-bold">Proposition de Mia</h3>
      <p className="mt-2 text-sm text-slate-600">Tu peux modifier le texte avant de l&apos;accepter.</p>
      <p className="mt-2 text-sm text-slate-600">Cette proposition suppose une contrepartie commerciale : vérifie qu&apos;elle existe réellement. La mention doit rester immédiatement visible.</p>
      <textarea aria-label="Texte proposé par Mia" disabled={saving} value={caption} onChange={(e) => setCaption(e.target.value)}
        className="mt-4 min-h-36 w-full rounded-xl border border-indigo-200 bg-white p-4" />
      {rewrite.changes.length > 0 && (
        <ul className="mt-4 space-y-2 text-sm">
          {rewrite.changes.map((change, index) => (
            <li key={index}>
              <span className="font-semibold">{change.reason}</span>
              <div className="text-slate-600">
                {change.before && <del className="mr-2 text-red-700">{change.before}</del>}
                {change.after && <ins className="text-emerald-700">{change.after}</ins>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <button type="button" disabled={saving || !caption.trim()} onClick={accept}
        className="mt-5 rounded-xl bg-accent px-5 py-3 font-bold text-white disabled:opacity-50">
        {saving ? 'Enregistrement…' : 'Accepter cette version'}
      </button>
      {message && <p role="status" className="mt-3 text-sm text-slate-700">{message}</p>}
    </section>
  );
}
