// Chemin : app/dashboard/archive/page.tsx
import Link from 'next/link';
import { createServerSupabase } from '@/lib/supabase/server';
import { checkLabel } from '@/lib/check-status';

export const dynamic = 'force-dynamic';
export default async function ArchivePage({
  searchParams,
}: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const number = Number(params.page ?? 1);
  const page = Number.isSafeInteger(number) && number > 0 && number <= 100 ? number : 1;
  const limit = 20, offset = (page - 1) * limit;
  const supabase = await createServerSupabase();
  const { data: records, count, error } = await supabase.from('verifications')
    .select('id,platform,ai_score,status,created_at,ai_risk_level', { count: 'exact' })
    .order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  return (
    <section className="space-y-7">
      <div>
        <p className="text-sm font-bold uppercase tracking-wide text-accent">Historique personnel</p>
        <h1 className="mt-2 font-heading text-4xl font-bold">Mes archives</h1>
        <p className="mt-2 text-slate-600">
          Consulte tes vérifications, les versions acceptées et les rapports PDF informatifs.
        </p>
      </div>
      {error ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">
        Historique indisponible.
      </p> : !records?.length ? <p className="rounded-xl bg-white p-6 text-slate-600">
        Aucune archive sur cette page. <Link className="font-semibold text-accent underline"
          href="/dashboard/check">Effectuer un contrôle</Link>
      </p> : <ul className="space-y-3">
        {records.map((item) => <li key={item.id}>
          <Link href={'/dashboard/archive/' + item.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 hover:border-indigo-400">
            <div>
              <p className="font-semibold capitalize">{item.platform}</p>
              <p className="mt-1 text-sm text-slate-500">
                {new Date(item.created_at).toLocaleString('fr-FR')}
              </p>
            </div>
            <span className="font-semibold text-primary">{checkLabel(item.status,item.ai_score)}</span>
            <span className="text-sm font-semibold text-accent">Voir le détail</span>
          </Link>
        </li>)}
      </ul>}
      <nav aria-label="Pagination des archives" className="flex items-center justify-between gap-3">
        {page > 1 ? <Link className="rounded-xl border border-slate-300 bg-white px-4 py-2"
          href={'/dashboard/archive?page=' + (page - 1)}>Précédent</Link> :
          <span className="text-slate-400">Première page</span>}
        <span className="text-sm text-slate-600">Page {page} · {count ?? 0} résultats</span>
        {(count ?? 0) > page * limit ?
          <Link className="rounded-xl border border-slate-300 bg-white px-4 py-2"
            href={'/dashboard/archive?page=' + (page + 1)}>Suivant</Link> :
          <span className="text-slate-400">Fin</span>}
      </nav>
    </section>
  );
}
