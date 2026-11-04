// Chemin : app/dashboard/page.tsx
import Link from 'next/link';
import { createServerSupabase } from '@/lib/supabase/server';
import { checkLabel, isScoredCheck } from '@/lib/check-status';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createServerSupabase();
  const { data: checks, error } = await supabase.from('verifications')
    .select('id,platform,ai_score,created_at,status')
    .order('created_at', { ascending: false })
    .limit(10);
  const completed = (checks ?? []).filter(isScoredCheck);
  const average = completed.length
    ? Math.round(completed.reduce((sum, item) => sum + (item.ai_score ?? 0), 0) / completed.length)
    : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-accent">Ton cockpit</p>
          <h1 className="mt-2 font-heading text-4xl font-bold text-primary">Tableau de bord</h1>
          <p className="mt-2 text-slate-600">Mia t&apos;aide à publier des collaborations plus transparentes.</p>
        </div>
        <Link href="/dashboard/check" className="rounded-xl bg-accent px-6 py-3 font-bold text-white shadow-md hover:bg-indigo-700">
          Check ma publication
        </Link>
      </div>
      {error && <div role="alert" className="space-y-2 rounded-xl bg-red-50 p-4 text-red-800">
        <p>Les vérifications sont momentanément indisponibles.</p>
        <a href="/dashboard" className="inline-block font-semibold underline">Réessayer le chargement</a>
      </div>}
      <div className="grid gap-5 sm:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-7">
          <p className="text-slate-600">Score moyen des dernières vérifications</p>
          <strong className="mt-3 block text-5xl text-primary">{average === null ? '—' : average + '/100'}</strong>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-7">
          <p className="text-slate-600">Vérifications récentes</p>
          <strong className="mt-3 block text-5xl text-primary">{error ? '—' : checks?.length ?? 0}</strong>
        </article>
      </div>
      <section aria-label="Outils MentionCheck" className="grid gap-4 sm:grid-cols-2">
        <Link href="/dashboard/mia" className="rounded-2xl border border-indigo-200 bg-indigo-50 p-6 hover:border-indigo-400">
          <h2 className="font-heading text-xl font-bold text-primary">Parler avec Mia</h2>
          <p className="mt-2 text-sm text-slate-700">Questions sur les mentions et les règles juridiques référencées.</p>
        </Link>
        <Link href="/dashboard/archive" className="rounded-2xl border border-slate-200 bg-white p-6 hover:border-indigo-400">
          <h2 className="font-heading text-xl font-bold text-primary">Mes archives</h2>
          <p className="mt-2 text-sm text-slate-700">Retrouver tes contrôles et exporter un rapport PDF informatif.</p>
        </Link>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-7">
        <h2 className="font-heading text-xl font-bold">Derniers checks</h2>
        {error ? <p className="mt-4 text-slate-600">Historique indisponible. Tes données restent enregistrées.</p> : checks?.length ? (
          <ul className="mt-5 divide-y divide-slate-100">
            {checks.map((item) => (
              <li className="flex flex-wrap items-center justify-between gap-4 py-4" key={item.id}>
                <span className="capitalize text-slate-700">{item.platform} — {new Date(item.created_at).toLocaleDateString('fr-FR')}</span>
                <span className="font-semibold text-primary">
                  {checkLabel(item.status, item.ai_score)}
                </span>
              </li>
            ))}
          </ul>
        ) : <p className="mt-4 text-slate-600">Aucune vérification. Lance ton premier check !</p>}
      </section>
    </div>
  );
}
