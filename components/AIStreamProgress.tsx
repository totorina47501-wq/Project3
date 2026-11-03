// Chemin : components/AIStreamProgress.tsx
'use client';

export type Stage = 'scan_text' | 'scan_visual' | 'scoring' | 'rewriting';
export type StageStatus = 'running' | 'complete' | 'quota_exceeded' | 'unavailable';
const names: Record<Stage, string> = {
  scan_text: 'Analyse du texte',
  scan_visual: 'Lecture du visuel',
  scoring: 'Calcul du score',
  rewriting: 'Réécriture IA',
};

export function AIStreamProgress({ stages }: { stages: Partial<Record<Stage, StageStatus>> }) {
  const order: Stage[] = ['scan_text', 'scan_visual', 'scoring', 'rewriting'];
  const entries = order.filter((name) => stages[name]);
  if (!entries.length) return null;
  return (
    <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5" aria-live="polite">
      <h2 className="font-heading text-lg font-bold">{entries.some((name) => stages[name] === 'unavailable') ?
        'Contrôle partiel : IA indisponible' : 'Mia analyse ta publication…'}</h2>
      <ol className="mt-3 space-y-2">
        {entries.map((name) => (
          <li key={name} className="flex items-center gap-2 text-sm">
            <span aria-hidden="true" className={stages[name] === 'complete' ? 'text-emerald-700' : 'text-accent'}>
              {stages[name] === 'complete' ? '✓' : '●'}
            </span>
            <span>{names[name]}</span>
            <span className="ml-auto text-slate-600">
              {stages[name] === 'running' ? 'En cours' :
                stages[name] === 'complete' ? 'Terminé' :
                  stages[name] === 'unavailable' ? 'Indisponible' : 'Quota atteint'}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
