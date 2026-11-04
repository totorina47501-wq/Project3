// Gestion explicite du consentement de réutilisation des textes acceptés.
'use client';
import { useState } from 'react';

export function PrivacySettings({ initialOptIn }: { initialOptIn: boolean }) {
  const [optIn, setOptIn] = useState(initialOptIn);
  const [saved, setSaved] = useState(initialOptIn);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  async function save() {
    setSaving(true); setMessage('');
    try {
      const response = await fetch('/api/account/consent', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ aiTrainingOptIn:optIn }),
      });
      const result = await response.json() as {error?:string;aiTrainingOptIn?:boolean};
      if(!response.ok || typeof result.aiTrainingOptIn !== 'boolean')
        throw new Error(result.error ?? 'Impossible de sauvegarder le choix.');
      setSaved(result.aiTrainingOptIn);
      setMessage('Préférence enregistrée. Tu peux la modifier à tout moment.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Enregistrement indisponible.');
    } finally { setSaving(false); }
  }

  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
    <h2 className="font-heading text-xl font-bold">Confidentialité et données</h2>
    <p className="text-sm text-slate-600">
      Par défaut, aucun texte accepté n&apos;est autorisé pour constituer un jeu
      d&apos;entraînement interne. Ce choix est indépendant des appels nécessaires
      pour analyser les publications lorsque tu actives explicitement l&apos;IA.
    </p>
    <label className="flex items-start gap-3 text-sm">
      <input type="checkbox" checked={optIn} onChange={(event) => setOptIn(event.target.checked)}
        className="mt-1 h-5 w-5 accent-indigo-600" />
      <span>J&apos;autorise MentionCheck à réutiliser les réécritures que j&apos;accepte
        pour améliorer ses modèles internes, sous réserve de la politique de confidentialité.
        Je peux retirer mon accord pour les utilisations futures.</span>
    </label>
    <button type="button" onClick={() => void save()} disabled={saving || saved === optIn}
      className="rounded-xl bg-accent px-5 py-3 font-bold text-white disabled:opacity-50">
      {saving ? 'Enregistrement…' : 'Enregistrer mon choix'}
    </button>
    {message && <p className="text-sm text-slate-700" role="status">{message}</p>}
    <div className="border-t border-slate-200 pt-5">
      <a href="/api/account/export"
        className="inline-flex rounded-xl border border-indigo-300 bg-white px-5 py-3 font-semibold text-indigo-700">
        Exporter mes données (JSON)
      </a>
      <p className="mt-2 text-xs text-slate-500">
        L&apos;export contient les données disponibles dans les tables de MentionCheck.
        Les fichiers binaires et données détenues par des prestataires sont exclus.
        Tu peux maintenant déposer et suivre une demande d&apos;effacement ci-dessous.
        La suppression technique complète n&apos;est pas encore automatisée.
      </p>
    </div>
  </section>;
}
