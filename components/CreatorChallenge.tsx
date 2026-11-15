'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  creatorChallengeMissionCount,
  creatorChallengeNiches,
  creatorChallengePlatforms,
  creatorChallengeGoals,
  creatorChallengeWeeks,
  defaultCreatorChallengeProgress,
  getCreatorChallengeProgressForAccount,
  getCreatorChallengeStorageKey,
  parseCreatorChallengeProgress,
  personalizeCreatorChallengeMission,
  type AccountScopedCreatorChallengeProgress,
  type CreatorChallengeProgress,
} from '@/lib/creator-challenge/model';

const missionLinks: Record<number, { href: string; label: string }> = {
  11: { href: '/dashboard/mia/creator', label: 'Préparer un brouillon avec Mia Creator' },
  16: { href: '/dashboard/check?execution=rules_only', label: 'Ouvrir Check ma publication, sans IA' },
  17: { href: '/dashboard/check?execution=rules_only', label: 'Relire une légende dans Check, sans IA' },
  26: { href: '/dashboard/brand-deals', label: 'Préparer mon media kit existant' },
  28: { href: '/dashboard/brand-deals', label: 'Voir le parcours première collaboration' },
  29: { href: '/dashboard/brand-deals', label: 'Préparer un brouillon de collaboration' },
};

export function CreatorChallenge({ accountHash }: { accountHash: string }) {
  const storageKey = useMemo(() => getCreatorChallengeStorageKey(accountHash), [accountHash]);
  const [storedProgress, setStoredProgress] = useState<AccountScopedCreatorChallengeProgress | null>(null);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [notice, setNotice] = useState('');
  const loaded = storedProgress?.storageKey === storageKey;
  const progress = getCreatorChallengeProgressForAccount(storedProgress, storageKey);
  const completedCount = progress.completedDays.length;

  useEffect(() => {
    try {
      const progress = parseCreatorChallengeProgress(window.localStorage.getItem(storageKey));
      setStoredProgress({ storageKey, progress });
      setStorageAvailable(true);
    } catch {
      setStoredProgress({ storageKey, progress: { ...defaultCreatorChallengeProgress } });
      setStorageAvailable(false);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!loaded) return;
    try {
      const isEmpty = !progress.started
        && progress.completedDays.length === 0
        && progress.niche === defaultCreatorChallengeProgress.niche
        && progress.platform === defaultCreatorChallengeProgress.platform
        && progress.goal === defaultCreatorChallengeProgress.goal;
      if (isEmpty) {
        window.localStorage.removeItem(storageKey);
      } else {
        window.localStorage.setItem(storageKey, JSON.stringify(progress));
      }
      setStorageAvailable(true);
    } catch {
      setStorageAvailable(false);
    }
  }, [loaded, progress, storageKey]);

  function updateProgress(update: Partial<CreatorChallengeProgress>) {
    setStoredProgress((current) => current?.storageKey === storageKey
      ? { storageKey, progress: { ...current.progress, ...update } }
      : current);
    setNotice('');
  }

  function toggleDay(day: number, complete: boolean) {
    const completedDays = complete
      ? [...new Set([...progress.completedDays, day])].sort((a, b) => a - b)
      : progress.completedDays.filter((completedDay) => completedDay !== day);
    updateProgress({ completedDays });
  }

  function resetProgress() {
    if (!window.confirm('Effacer la progression de ce programme sur cet appareil ?')) return;
    setStoredProgress({ storageKey, progress: { ...defaultCreatorChallengeProgress } });
    setNotice('La progression de ce compte a été effacée sur cet appareil.');
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-bold uppercase tracking-wide text-accent">Pour les créatrices et créateurs débutants</p>
        <h1 className="font-heading text-3xl font-bold text-primary sm:text-4xl">Mon programme créateur — 30 jours</h1>
        <p className="text-slate-600">Un petit pas à la fois : clarifier ton univers, préparer des contenus responsables, puis organiser un premier media kit et une approche de marque.</p>
        <p className="rounded-lg bg-indigo-50 p-3 text-sm font-semibold text-indigo-900">Progression uniquement sur cet appareil. Aucun contenu n’est publié automatiquement et aucun résultat n’est garanti.</p>
      </header>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" aria-labelledby="challenge-preferences-title">
        <h2 id="challenge-preferences-title" className="font-heading text-xl font-bold text-primary">Personnalise ton parcours</h2>
        <p className="text-sm text-slate-600">Ces choix servent uniquement à adapter les consignes. N’indique pas de nom, de coordonnées ni d’information sensible.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm font-semibold">
            Niche
            <select
              aria-label="Niche"
              value={progress.niche}
              onChange={(event) => updateProgress({ niche: event.target.value as CreatorChallengeProgress['niche'] })}
              className="mt-2 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
            >
              {creatorChallengeNiches.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold">
            Plateforme
            <select
              aria-label="Plateforme"
              value={progress.platform}
              onChange={(event) => updateProgress({ platform: event.target.value as CreatorChallengeProgress['platform'] })}
              className="mt-2 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
            >
              {creatorChallengePlatforms.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold">
            Objectif
            <select
              aria-label="Objectif"
              value={progress.goal}
              onChange={(event) => updateProgress({ goal: event.target.value as CreatorChallengeProgress['goal'] })}
              className="mt-2 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
            >
              {creatorChallengeGoals.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" aria-labelledby="challenge-progress-title">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="challenge-progress-title" className="font-heading text-xl font-bold text-primary">Ta progression</h2>
          <p aria-live="polite" className="font-semibold text-slate-700">{completedCount} sur {creatorChallengeMissionCount} missions terminées</p>
        </div>
        <progress aria-label="Progression du programme" className="h-3 w-full accent-indigo-700" max={creatorChallengeMissionCount} value={completedCount} />
        {!progress.started && (
          <div className="space-y-3 rounded-xl bg-slate-50 p-4">
            <p className="text-sm text-slate-700">Les missions sont des suggestions pratiques, à réaliser à ton rythme. Tu peux commencer par le jour 1 et revenir ici quand tu le souhaites.</p>
            <button
              type="button"
              onClick={() => updateProgress({ started: true })}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-accent px-5 py-3 font-bold text-white hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 sm:w-auto"
            >
              Commencer le jour 1
            </button>
          </div>
        )}
        {progress.started && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">Un parcours déterministe préparé dans l’application, sans génération IA.</p>
            <button
              type="button"
              onClick={resetProgress}
              className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
            >
              Réinitialiser ma progression
            </button>
          </div>
        )}
        {notice && <p role="status" className="text-sm text-slate-700">{notice}</p>}
        {!storageAvailable && <p role="status" className="text-sm text-amber-900">Le stockage local est indisponible : ta progression restera seulement le temps de cette session.</p>}
      </section>

      {progress.started && creatorChallengeWeeks.map((week) => (
        <section key={week.week} className="space-y-3" aria-labelledby={`creator-challenge-week-${week.week}`}>
          <h2 id={`creator-challenge-week-${week.week}`} className="font-heading text-2xl font-bold text-primary">Semaine {week.week} — {week.title}</h2>
          <ul className="space-y-3">
            {week.missions.map(([title, detail], index) => {
              const day = creatorChallengeWeeks.slice(0, week.week - 1).reduce((total, item) => total + item.missions.length, 0) + index + 1;
              const mission = personalizeCreatorChallengeMission(
                { day, week: week.week, title, detail },
                progress,
              );
              const link = missionLinks[day];
              return (
                <li key={mission.day} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <label className="flex min-h-11 cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={progress.completedDays.includes(mission.day)}
                      onChange={(event) => toggleDay(mission.day, event.target.checked)}
                      className="mt-1 h-5 w-5 shrink-0 accent-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                      aria-label={`Jour ${mission.day} — ${mission.title}`}
                    />
                    <span className="font-semibold text-slate-900">Jour {mission.day} — {mission.title}</span>
                  </label>
                  <p className="ml-8 mt-1 text-sm leading-6 text-slate-700">{mission.detail}</p>
                  {link && <Link href={link.href} className="ml-8 mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-indigo-800 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500">
                    {link.label}
                  </Link>}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
