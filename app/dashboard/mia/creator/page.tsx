'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import type { Platform, Violation } from '@/lib/ai/schemas';

type CreatorResponse = {
  hooks: string[];
  script: { durationSeconds: number; lines: string[] };
  caption: string;
  cta: string;
  manualPlatformChecks: string[];
  safePublish: {
    supportedRules: Array<{ code: string; label: string; detail: string }>;
    precheckViolations: Violation[];
    omissions: string[];
    limits: string[];
  };
  disclaimer: string;
};

const platforms: Array<{ value: Extract<Platform, 'instagram' | 'tiktok' | 'youtube'>; label: string }> = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
];

const objectives = [
  { value: 'visibilite', label: 'Visibilité' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'conversion', label: 'Conversion' },
  { value: 'communaute', label: 'Communauté' },
] as const;

function encodeCheckLink(platform: Platform, caption: string) {
  const params = new URLSearchParams({
    platform,
    execution: 'rules_only',
    caption,
  });
  return `/dashboard/check?${params.toString()}`;
}

export default function MiaCreatorPage() {
  const [niche, setNiche] = useState('');
  const [platform, setPlatform] = useState<'instagram' | 'tiktok' | 'youtube'>('instagram');
  const [objective, setObjective] = useState<(typeof objectives)[number]['value']>('visibilite');
  const [topic, setTopic] = useState('');
  const [isPartnership, setIsPartnership] = useState<'yes' | 'no'>('no');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CreatorResponse | null>(null);
  const [hooks, setHooks] = useState<string[]>([]);
  const [scriptLines, setScriptLines] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [cta, setCta] = useState('');
  const [notice, setNotice] = useState('');

  const checkLink = useMemo(() => encodeCheckLink(platform, caption || ''), [platform, caption]);

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(`${label} copié.`);
    } catch {
      setNotice(`Copie impossible. Sélectionne le texte pour copier ${label.toLowerCase()}.`);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/mia/creator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche,
          platform,
          objective,
          topic,
          isPartnership: isPartnership === 'yes',
        }),
      });
      const data = await response.json() as CreatorResponse | { error?: string };
      if (!response.ok || !('hooks' in data)) {
        throw new Error((data as { error?: string }).error ?? 'Génération IA indisponible.');
      }
      setResult(data);
      setHooks(data.hooks);
      setScriptLines(data.script.lines);
      setCaption(data.caption);
      setCta(data.cta);
    } catch (cause) {
      setResult(null);
      setHooks([]);
      setScriptLines([]);
      setCaption('');
      setCta('');
      setError(cause instanceof Error ? cause.message : 'Génération IA indisponible.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-bold uppercase tracking-wide text-accent">Mia Creator</p>
        <h1 className="font-heading text-3xl font-bold text-primary sm:text-4xl">Coach de contenu + SafePublish</h1>
        <p className="text-slate-600">Prépare ta publication en brouillon (accroches, script 30–60 s, légende, CTA), puis passe par SafePublish avant publication.</p>
      </header>

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <label className="block font-semibold">Ta niche
          <input
            value={niche}
            onChange={(event) => setNiche(event.target.value)}
            maxLength={80}
            required
            className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3 font-normal"
            placeholder="Ex: beauté naturelle, cuisine rapide, sport à la maison"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block font-semibold">Plateforme
            <select
              value={platform}
              onChange={(event) => setPlatform(event.target.value as 'instagram' | 'tiktok' | 'youtube')}
              className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal"
            >
              {platforms.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>

          <label className="block font-semibold">Objectif
            <select
              value={objective}
              onChange={(event) => setObjective(event.target.value as (typeof objectives)[number]['value'])}
              className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal"
            >
              {objectives.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
        </div>

        <label className="block font-semibold">Sujet de la publication
          <textarea
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            required
            minLength={4}
            maxLength={240}
            rows={3}
            className="mt-2 block w-full rounded-xl border border-slate-300 p-4 font-normal"
            placeholder="Ex: routine du matin, test produit, avant/après"
          />
        </label>

        <fieldset className="rounded-xl border border-slate-200 p-3">
          <legend className="px-1 text-sm font-semibold">Partenariat commercial ?</legend>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            <label className="inline-flex min-h-11 items-center gap-2">
              <input type="radio" name="partnership" value="no" checked={isPartnership === 'no'} onChange={() => setIsPartnership('no')} />
              Non
            </label>
            <label className="inline-flex min-h-11 items-center gap-2">
              <input type="radio" name="partnership" value="yes" checked={isPartnership === 'yes'} onChange={() => setIsPartnership('yes')} />
              Oui
            </label>
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={loading || niche.trim().length < 2 || topic.trim().length < 4}
          className="w-full rounded-xl bg-accent px-6 py-3.5 font-bold text-white shadow-md hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Génération…' : 'Générer mon brouillon avec Mia Creator'}
        </button>

        <p className="text-xs text-slate-500">Aucune publication automatique. Préparation manuelle uniquement.</p>
      </form>

      {notice && <p role="status" className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">{notice}</p>}
      {error && (
        <div role="alert" className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
          <p className="font-semibold">{error.includes('Génération IA indisponible') ? 'Génération IA indisponible' : 'Erreur de génération'}</p>
          <p className="text-sm">Tu peux continuer avec le contrôle sans IA, gratuit et disponible.</p>
          <Link href="/dashboard/check?execution=rules_only" className="inline-flex min-h-11 items-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-red-800 underline">
            Ouvrir SafePublish sans IA
          </Link>
        </div>
      )}

      {result && (
        <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" aria-label="Résultat Mia Creator">
          <div className="space-y-2 rounded-xl bg-indigo-50 p-4 text-sm text-indigo-900">
            <p className="font-semibold">{result.disclaimer}</p>
            <p>Relis et adapte chaque proposition à ta situation réelle avant publication.</p>
          </div>

          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="font-heading text-xl font-bold">Accroches</h2>
              <button type="button" onClick={() => void copyText(hooks.join('\n'), 'Accroches')} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold">Copier</button>
            </div>
            <div className="space-y-2">
              {hooks.map((hook, index) => (
                <textarea
                  key={index}
                  value={hook}
                  onChange={(event) => setHooks((previous) => previous.map((item, idx) => idx === index ? event.target.value : item))}
                  rows={2}
                  maxLength={140}
                  className="block w-full rounded-xl border border-slate-300 p-3"
                  aria-label={`Accroche ${index + 1}`}
                />
              ))}
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="font-heading text-xl font-bold">Script {result.script.durationSeconds}s</h2>
              <button type="button" onClick={() => void copyText(scriptLines.join('\n'), 'Script')} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold">Copier</button>
            </div>
            <div className="space-y-2">
              {scriptLines.map((line, index) => (
                <textarea
                  key={index}
                  value={line}
                  onChange={(event) => setScriptLines((previous) => previous.map((item, idx) => idx === index ? event.target.value : item))}
                  rows={2}
                  maxLength={180}
                  className="block w-full rounded-xl border border-slate-300 p-3"
                  aria-label={`Ligne script ${index + 1}`}
                />
              ))}
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="font-heading text-xl font-bold">Légende</h2>
              <button type="button" onClick={() => void copyText(caption, 'Légende')} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold">Copier</button>
            </div>
            <textarea
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              rows={5}
              maxLength={1200}
              className="block w-full rounded-xl border border-slate-300 p-3"
              aria-label="Légende proposée"
            />
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="font-heading text-xl font-bold">Appel à l’action</h2>
              <button type="button" onClick={() => void copyText(cta, 'CTA')} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold">Copier</button>
            </div>
            <textarea
              value={cta}
              onChange={(event) => setCta(event.target.value)}
              rows={2}
              maxLength={180}
              className="block w-full rounded-xl border border-slate-300 p-3"
              aria-label="CTA proposé"
            />
          </section>

          <section className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-4" aria-labelledby="safe-publish-title">
            <h2 id="safe-publish-title" className="font-heading text-xl font-bold text-amber-900">SafePublish</h2>
            <p className="text-sm text-amber-900">Passe ensuite par le moteur de vérification existant: génération de texte ≠ vérification juridique ≠ garantie de conformité.</p>

            <div>
              <h3 className="text-sm font-semibold text-amber-900">Règles actuellement vérifiées</h3>
              <ul className="mt-2 space-y-1 text-sm text-amber-900">
                {result.safePublish.supportedRules.map((rule) => <li key={rule.code}><strong>{rule.code}</strong> — {rule.label}</li>)}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-amber-900">Pré-contrôle sur ta légende actuelle</h3>
              {result.safePublish.precheckViolations.length === 0 ? (
                <p className="mt-2 text-sm text-amber-900">Aucune violation détectée par les règles texte. Vérification finale toujours requise.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm text-amber-900">
                  {result.safePublish.precheckViolations.map((item) => <li key={item.code}><strong>{item.code}</strong> — {item.title}</li>)}
                </ul>
              )}
            </div>

            {result.safePublish.omissions.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-amber-900">Omissions de transparence potentielles</h3>
                <ul className="mt-2 space-y-1 text-sm text-amber-900">
                  {result.safePublish.omissions.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold text-amber-900">Limites connues</h3>
              <ul className="mt-2 space-y-1 text-sm text-amber-900">
                {result.safePublish.limits.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href={checkLink} className="inline-flex min-h-11 items-center rounded-xl bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800">
                Ouvrir Check ma publication (SafePublish)
              </Link>
              <button type="button" onClick={() => void copyText(caption, 'Légende pour SafePublish')} className="inline-flex min-h-11 items-center rounded-xl border border-amber-400 px-4 py-2 text-sm font-semibold text-amber-900">
                Copier la légende
              </button>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-slate-700">Rappels manuels par plateforme</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {result.manualPlatformChecks.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
        </section>
      )}
    </div>
  );
}
