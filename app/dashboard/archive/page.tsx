// Historique privé, filtres validés et pagination sur le décompte réel.
import Link from 'next/link';
import { requireUser,publicError } from '@/lib/security/auth';
import { checkLabel } from '@/lib/check-status';
import { archiveFiltersSchema,archivePageHref } from '@/lib/archive/filters';

export const dynamic = 'force-dynamic';
export default async function ArchivePage({searchParams}: {
  searchParams:Promise<{page?:string;q?:string;platform?:string;status?:string;from?:string;to?:string}>;
}) {
  const parsed=archiveFiltersSchema.safeParse(await searchParams);
  if(!parsed.success)return <section className="space-y-4"><h1 className="text-3xl font-bold">Mes archives</h1><p role="alert">Filtres invalides : vérifie les dates, la recherche et le numéro de page.</p><Link className="text-accent underline" href="/dashboard/archive">Réinitialiser les filtres</Link></section>;
  const filters=parsed.data;
  const {page}=filters,limit=20,offset=(page-1)*limit;
  let records:Array<{id:string;platform:string;ai_score:number|null;status:string;created_at:string;ai_risk_level:string|null}>=[];
  let count:number|null=null;
  let failure='';
  try {
    const {user,client}=await requireUser();
    let query=client.from('verifications')
      .select('id,platform,ai_score,status,created_at,ai_risk_level',{count:'exact'}).eq('user_id',user.id);
    if(filters.platform)query=query.eq('platform',filters.platform);
    if(filters.status)query=query.eq('status',filters.status);
    if(filters.q)query=query.ilike('content_text','%'+filters.q+'%');
    if(filters.from)query=query.gte('created_at',filters.from+'T00:00:00.000Z');
    if(filters.to)query=query.lte('created_at',filters.to+'T23:59:59.999999Z');
    const result=await query.order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+limit-1);
    if(result.error)throw new Error('Historique indisponible.');
    records=result.data??[];count=result.count;
  }catch(error){failure=publicError(error).message;}
  const inputClass='mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5';
  return <section className="space-y-7">
    <div>
      <p className="text-sm font-bold uppercase tracking-wide text-accent">Historique personnel</p>
      <h1 className="mt-2 font-heading text-4xl font-bold">Mes archives</h1>
      <p className="mt-2 text-slate-600">Consulte tes vérifications, les versions acceptées et les rapports PDF informatifs.</p>
      <Link href="/dashboard/brand-deals" className="mt-2 inline-block font-semibold text-accent underline">Gérer mes collaborations commerciales</Link>
    </div>
    <form method="get" className="grid gap-3 rounded-2xl border bg-white p-5 sm:grid-cols-3" aria-label="Filtrer les vérifications">
      <div><label htmlFor="archive-q">Rechercher dans le texte</label><input id="archive-q" name="q" type="search" maxLength={100} defaultValue={filters.q} className={inputClass}/></div>
      <div><label htmlFor="archive-platform">Plateforme</label><select id="archive-platform" name="platform" defaultValue={filters.platform} className={inputClass}><option value="">Toutes</option>{['instagram','tiktok','youtube','linkedin'].map(value=><option key={value} value={value}>{value}</option>)}</select></div>
      <div><label htmlFor="archive-status">État</label><select id="archive-status" name="status" defaultValue={filters.status} className={inputClass}><option value="">Tous</option>{[['queued','En attente'],['processing','En traitement'],['completed','Terminée'],['accepted','Version acceptée'],['kept','Version conservée'],['failed','Échec']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
      <div><label htmlFor="archive-from">Depuis (UTC)</label><input id="archive-from" name="from" type="date" defaultValue={filters.from} className={inputClass}/></div>
      <div><label htmlFor="archive-to">Jusqu’au (UTC)</label><input id="archive-to" name="to" type="date" defaultValue={filters.to} min={filters.from||undefined} className={inputClass}/></div>
      <div className="flex items-end gap-3"><button className="rounded-lg bg-accent px-4 py-2.5 font-semibold text-white">Filtrer</button><Link href="/dashboard/archive" className="py-2 text-accent underline">Réinitialiser</Link></div>
    </form>
    {failure?<p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{failure}</p>:!records.length?<p className="rounded-xl bg-white p-6 text-slate-600">Aucune archive sur cette page. <Link className="font-semibold text-accent underline" href="/dashboard/check">Effectuer un contrôle</Link></p>:<ul className="space-y-3">{records.map(item=><li key={item.id}>
      <Link href={'/dashboard/archive/'+item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 hover:border-indigo-400">
        <div><p className="font-semibold capitalize">{item.platform}</p><p className="mt-1 text-sm text-slate-500">{new Date(item.created_at).toLocaleString('fr-FR',{timeZone:'UTC'})} UTC</p></div>
        <span className="font-semibold text-primary">{checkLabel(item.status,item.ai_score)}</span><span className="text-sm font-semibold text-accent">Voir le détail</span>
      </Link>
    </li>)}</ul>}
    {!failure && <nav aria-label="Pagination des archives" className="flex items-center justify-between gap-3">
      {page>1?<Link className="rounded-xl border border-slate-300 bg-white px-4 py-2" href={archivePageHref(filters,page-1)}>Précédent</Link>:<span className="text-slate-400">Première page</span>}
      <span className="text-sm text-slate-600">Page {page} · {count===null?'Nombre indisponible':count+' résultats'}</span>
      {count!==null&&count>page*limit?<Link className="rounded-xl border border-slate-300 bg-white px-4 py-2" href={archivePageHref(filters,page+1)}>Suivant</Link>:<span className="text-slate-400">Fin</span>}
    </nav>}
  </section>;
}
