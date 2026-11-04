// Chemin : app/dashboard/check/page.tsx
'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import { ComplianceScore } from '@/components/ComplianceScore';
import { ViolationList } from '@/components/ViolationList';
import { AIRewriteDiff } from '@/components/AIRewriteDiff';
import { AIStreamProgress, type Stage, type StageStatus } from '@/components/AIStreamProgress';
import type { AnalysisResult, Platform } from '@/lib/ai/schemas';

type StreamData = { status?: StageStatus; score?: number; message?: string };
const platformNames: { value: Platform; name: string }[] = [
  { value: 'instagram', name: 'Instagram' },
  { value: 'tiktok', name: 'TikTok' },
  { value: 'youtube', name: 'YouTube' },
  { value: 'linkedin', name: 'LinkedIn' },
];

async function uploadImage(file: File, signal: AbortSignal) {
  const accepted = ['image/jpeg', 'image/png', 'image/webp'];
  if (!accepted.includes(file.type) || file.size > 8 * 1024 * 1024) {
    throw new Error('Choisis une image JPEG, PNG ou WebP de moins de 8 Mo.');
  }
  // Réduire le visuel côté navigateur avant l'envoi (1024 px maximum).
  const bitmap = await createImageBitmap(file);
  let prepared: File;
  try {
    const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Compression image impossible.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Conversion impossible.')),
        'image/webp', 0.86));
    prepared = new File([blob], 'publication.webp', { type: 'image/webp' });
  } finally {
    bitmap.close();
  }
  const response = await fetch('/api/media/upload-url', {
    signal,
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mime: prepared.type, size: prepared.size }),
  });
  const data = await response.json() as {
    path?: string; token?: string; assetId?: string; error?: string;
  };
  if (!response.ok || !data.path || !data.token || !data.assetId) {
    throw new Error(data.error ?? 'Impossible de préparer le média.');
  }
  const { error } = await createBrowserSupabase()
    .storage.from('verification-media')
    .uploadToSignedUrl(data.path, data.token, prepared, { contentType: prepared.type });
  if (error) throw new Error('Impossible de transférer le média privé.');
  signal.throwIfAborted();
  const completed = await fetch('/api/media/complete', {
    signal,
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assetId: data.assetId }),
  });
  if (!completed.ok) {
    throw new Error('Fichier transféré, mais sa confirmation a échoué. Recommence le contrôle.');
  }
  return data.path;
}

export default function CheckPage() {
  const [caption, setCaption] = useState('');
  const [platform, setPlatform] = useState<Platform>('instagram');
  const [execution, setExecution] = useState<'rules_only' | 'ai'>('rules_only');
  const [image, setImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [stages, setStages] = useState<Partial<Record<Stage, StageStatus>>>({});
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [requestedExecution, setRequestedExecution] = useState<'rules_only' | 'ai'>('rules_only');
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => { pending.current?.abort(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || !caption.trim()) return;
    const controller = new AbortController();
    pending.current = controller;
    setRequestedExecution(execution);
    setLoading(true);
    setStages({});
    setResult(null);
    setError('');
    setNotice('');
    try {
      const path = execution === 'ai' && image ? await uploadImage(image, controller.signal) : undefined;
      controller.signal.throwIfAborted();
      const response = await fetch('/api/check', {
        signal: controller.signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption, platform, execution, mediaUrl: path, mediaType: path ? 'image' : 'none',
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? 'La vérification est indisponible.');
      }
      if (!response.body) throw new Error('Le flux de vérification est indisponible.');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let receivedDone = false;
      try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() ?? '';
        for (const block of blocks) {
          const kind = block.match(/^event: (.+)$/m)?.[1];
          const payload = block.match(/^data: (.+)$/m)?.[1];
          if (!kind || !payload) continue;
          const data = JSON.parse(payload) as StreamData & AnalysisResult;
          if (['scan_text', 'scan_visual', 'scoring', 'rewriting'].includes(kind)) {
            const stage = kind as Stage;
            setStages((previous) => ({
              ...previous, [stage]: data.status ?? 'complete',
            }));
          }
          if (kind === 'error') throw new Error(data.message ?? 'Échec de l analyse.');
          if (kind === 'done') {
            receivedDone = true;
            setResult(data);
          }
        }
      }
      if (!receivedDone) throw new Error('Le flux a été interrompu avant la fin du check.');
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        setStages({});
        setResult(null);
        setError(cause instanceof Error ? cause.message : 'Une erreur est survenue.');
      }
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setLoading(false);
      }
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <div>
        <p className="text-sm font-bold uppercase tracking-widest text-accent">Avec Mia</p>
        <h1 className="mt-2 font-heading text-4xl font-bold text-primary">Check ma publication</h1>
        <p className="mt-3 text-slate-600">Colle une légende et, si tu veux, ajoute une image. Mia repère les signaux à corriger avant publication.</p>
      </div>
      <form onSubmit={submit} aria-busy={loading} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <label className="block font-semibold">
          Plateforme
          <select disabled={loading} value={platform} onChange={(event) => setPlatform(event.target.value as Platform)}
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3">
            {platformNames.map((item) => <option key={item.value} value={item.value}>{item.name}</option>)}
          </select>
        </label>
        <fieldset disabled={loading} className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <legend className="px-2 font-semibold">Mode de vérification</legend>
          <label className="flex items-start gap-3 text-sm">
            <input type="radio" name="execution" value="rules_only" checked={execution === 'rules_only'}
              onChange={() => setExecution('rules_only')} className="mt-1" />
            <span><strong>Sans IA, sans crédit OpenAI (par défaut)</strong>
              <span className="mt-1 block text-slate-600">Règles déterministes uniquement. Score provisoire, pas de réécriture.</span>
            </span>
          </label>
          <label className="mt-4 flex items-start gap-3 text-sm">
            <input type="radio" name="execution" value="ai" checked={execution === 'ai'}
              onChange={() => setExecution('ai')} className="mt-1" />
            <span><strong>Analyse avec Mia (utilise des crédits OpenAI)</strong>
              <span className="mt-1 block text-slate-600">N&apos;active pas cette option pendant les tests sans budget IA.</span>
            </span>
          </label>
        </fieldset>
        <label className="block font-semibold">
          Légende sponsorisée
          <textarea disabled={loading} required minLength={1} maxLength={10000} value={caption}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="Voici mon dernier produit préféré…"
            className="mt-2 block min-h-48 w-full rounded-xl border border-slate-300 p-4 font-normal outline-none focus:border-accent" />
        </label>
        {execution === 'ai' && <label className="block font-semibold">
          Visuel (facultatif)
          <input disabled={loading} type="file" accept="image/jpeg,image/png,image/webp"
            onChange={(event) => setImage(event.target.files?.[0] ?? null)}
            className="mt-2 block w-full text-sm font-normal text-slate-600" />
          <span className="mt-2 block text-xs font-normal text-slate-500">
            JPEG, PNG ou WebP, 8 Mo max. Les vidéos et carrousels arrivent prochainement.
          </span>
        </label>}
        {execution === 'rules_only' && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
          Aucun appel GPT-4o / Whisper ne sera effectué dans ce mode. Tu peux vérifier la légende
          sans consommer de crédit OpenAI.
        </p>}
        <button disabled={loading || !caption.trim()} type="submit"
          className="w-full rounded-xl bg-accent px-6 py-3.5 font-bold text-white shadow-md hover:bg-indigo-700 disabled:opacity-50">
          {loading ? 'Vérification…' : execution === 'ai' ? 'Analyser avec Mia (crédits IA)' : 'Vérifier sans IA'}
        </button>
        {loading && <button type="button" onClick={() => {
          pending.current?.abort();
          setStages({});
          setNotice('Attente arrêtée. Une opération déjà reçue par le serveur peut continuer ; consulte tes archives avant de relancer.');
        }} className="w-full rounded-xl border border-slate-300 px-4 py-3 font-semibold">
          Arrêter l’attente
        </button>}
      </form>
      <AIStreamProgress stages={stages} />
      {notice && <p role="status" className="rounded-xl bg-slate-100 p-4 text-sm text-slate-700">{notice}</p>}
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</p>}
      {result && (
        <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-heading text-2xl font-bold">
            {result.analysisMode === 'rules_only'
              ? 'Contrôle automatique des mentions terminé'
              : result.score >= 80 ? 'Aucun signal majeur détecté'
                : 'Mia a repéré des points à vérifier'}
          </h2>
          {result.analysisMode !== 'full' && (
            <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
              <p className="font-bold">{result.analysisMode === 'rules_only' && requestedExecution === 'rules_only'
                ? 'Contrôle déterministe volontairement sélectionné : aucun appel IA'
                : 'Analyse partielle : une fonction IA est indisponible'}</p>
              <p className="mt-2 text-sm">
                Le score ci-dessous est provisoire, pas une validation juridique.
                Une absence de signalement ne garantit pas la conformité.
              </p>
              {result.warnings.map((warning, index) =>
                <p key={index} className="mt-1 text-sm">{warning}</p>)}
            </div>
          )}
          <ComplianceScore score={result.score} />
          <ViolationList violations={result.violations} />
          {result.aiFlags.length > 0 && (
            <section>
              <h3 className="font-heading text-lg font-bold">Observations complémentaires de Mia</h3>
              <ul className="mt-3 space-y-2">
                {result.aiFlags.map((flag, index) => (
                  <li key={index} className="rounded-lg bg-slate-50 p-3 text-sm">
                    <strong>{flag.title}</strong> — {flag.explanation}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {result.rewrite && <AIRewriteDiff rewrite={result.rewrite} verificationId={result.verificationId} />}
          {result.score < 60 && !result.rewrite && (
            <p className="rounded-lg bg-amber-50 p-3 text-amber-800">
              {result.analysisMode === 'rules_only' && requestedExecution === 'rules_only'
                ? 'Réécriture non générée : tu as choisi le mode sans IA.'
                : result.analysisMode !== 'full'
                  ? 'Réécriture indisponible : le service IA a rencontré une erreur.'
                  : 'Aucune réécriture proposée : le quota de réécritures est peut-être atteint.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
