'use client';
import { useEffect,useState,type FormEvent } from 'react';
import Link from 'next/link';
import type { DealRecord } from '@/lib/brand-deals/model';

type Listing={items:DealRecord[];total:number|null;page:number;pageSize:number;error?:string};
type FormValues={brand_name:string;start_date:string;end_date:string;contract_url:string;verification_ids:string};
const emptyForm=():FormValues=>({brand_name:'',start_date:new Date().toISOString().slice(0,10),end_date:'',contract_url:'',verification_ids:''});
export function BrandDeals() {
  const [form,setForm]=useState<FormValues>(emptyForm);
  const [editing,setEditing]=useState<string|null>(null);
  const [listing,setListing]=useState<Listing|null>(null);
  const [state,setState]=useState('all');
  const [search,setSearch]=useState('');
  const [query,setQuery]=useState('');
  const [page,setPage]=useState(1);
  const [version,setVersion]=useState(0);
  const [loading,setLoading]=useState(true);
  const [pending,setPending]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [snapshots,setSnapshots]=useState<Record<string,{loading?:boolean;error?:string;payload?:unknown}>>({});
  const [confirmation,setConfirmation]=useState<{item:DealRecord;action:'archive'|'delete'}|null>(null);
  const params=new URLSearchParams({state,q:query,page:String(page)}).toString();
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setListing(null);setError('');
    void fetch('/api/brand-deals?'+params,{cache:'no-store',signal:controller.signal})
      .then(async response=>{
        const data=await response.json() as Listing;
        if(!response.ok)throw new Error(data.error??'Registre indisponible.');
        if(!controller.signal.aborted)setListing(data);
      }).catch(cause=>{if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Registre indisponible.');})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[params,version]);
  async function loadSnapshot(id:string) {
    if(snapshots[id])return;
    setSnapshots(previous=>({...previous,[id]:{loading:true}}));
    try {
      const response=await fetch('/api/brand-deals/'+id,{cache:'no-store'});
      const result=await response.json() as {item?:DealRecord;error?:string};
      if(!response.ok||!result.item)throw new Error(result.error??'Snapshot indisponible.');
      setSnapshots(previous=>({...previous,[id]:{payload:result.item?.archive_payload}}));
    }catch(cause){setSnapshots(previous=>({...previous,[id]:{error:cause instanceof Error?cause.message:'Snapshot indisponible.'}}));}
  }
  useEffect(()=>{if(confirmation)document.getElementById('deal-confirm-title')?.focus();},[confirmation]);
  function cancelConfirmation() {
    if(confirmation)document.getElementById('deal-'+confirmation.action+'-'+confirmation.item.id)?.focus();
    setConfirmation(null);
  }
  function change(key:keyof FormValues,value:string){setForm(previous=>({...previous,[key]:value}));}
  function reset(){setForm(emptyForm());setEditing(null);}
  async function save(event:FormEvent) {
    event.preventDefault();setPending(true);setError('');setMessage('');
    try {
      const response=await fetch('/api/brand-deals'+(editing?'/'+editing:''),{
        method:editing?'PATCH':'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...form,end_date:form.end_date||null,contract_url:form.contract_url||null,
          verification_ids:form.verification_ids.split(/[\s,]+/).filter(Boolean)}),
      });
      const result=await response.json() as {error?:string};
      if(!response.ok)throw new Error(result.error??'Enregistrement impossible.');
      reset();setMessage('Brouillon enregistré.');setVersion(value=>value+1);
    }catch(cause){setError(cause instanceof Error?cause.message:'Enregistrement impossible.');}
    finally{setPending(false);}
  }
  async function confirmAction() {
    if(!confirmation)return;
    setPending(true);setError('');setMessage('');
    try {
      const response=await fetch('/api/brand-deals/'+confirmation.item.id+(confirmation.action==='archive'?'/archive':''),{method:confirmation.action==='archive'?'POST':'DELETE'});
      if(!response.ok){const result=await response.json() as {error?:string};throw new Error(result.error??'Action impossible.');}
      if(editing===confirmation.item.id)reset();
      setMessage(confirmation.action==='archive'?'Collaboration archivée. Son contenu et ses liens sont désormais immuables.':'Brouillon supprimé.');
      setConfirmation(null);setVersion(value=>value+1);
    }catch(cause){setError(cause instanceof Error?cause.message:'Action impossible.');}
    finally{setPending(false);}
  }
  function edit(item:DealRecord) {
    setEditing(item.id);setForm({brand_name:item.brand_name,start_date:item.start_date,end_date:item.end_date??'',contract_url:item.contract_url??'',verification_ids:(item.brand_deal_verifications??[]).map(link=>link.verification_id).join('\n')});
    document.getElementById('deal-brand')?.focus();
  }
  const inputClass='mt-1 w-full rounded-lg border border-slate-300 p-2.5';
  return <div className="space-y-6">
    <form onSubmit={save} className="space-y-4 rounded-2xl border bg-white p-6" aria-labelledby="deal-form-title">
      <h2 id="deal-form-title" className="text-xl font-bold">{editing?'Modifier le brouillon':'Créer un brouillon'}</h2>
      <div><label htmlFor="deal-brand" className="font-semibold">Marque</label><input id="deal-brand" required maxLength={200} value={form.brand_name} onChange={event=>change('brand_name',event.target.value)} className={inputClass}/></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label htmlFor="deal-start">Date de début</label><input id="deal-start" type="date" required value={form.start_date} onChange={event=>change('start_date',event.target.value)} className={inputClass}/></div>
        <div><label htmlFor="deal-end">Date de fin (facultatif)</label><input id="deal-end" type="date" min={form.start_date} value={form.end_date} onChange={event=>change('end_date',event.target.value)} className={inputClass}/></div>
      </div>
      <div><label htmlFor="deal-verifications">Identifiants de tes vérifications (facultatif, 50 maximum)</label>
        <textarea id="deal-verifications" rows={3} value={form.verification_ids} onChange={event=>change('verification_ids',event.target.value)} aria-describedby="deal-verification-help" className={inputClass}/>
        <p id="deal-verification-help" className="mt-1 text-sm text-slate-600">Un UUID par ligne, disponible dans l’adresse du détail des <Link href="/dashboard/archive" className="underline">vérifications</Link>. Elles doivent être finalisées avant l’archivage.</p>
      </div>
      {form.contract_url && <p className="text-sm text-slate-600">Contrat privé conservé : <code className="break-all">{form.contract_url}</code>. Aucun téléversement de contrat n’est proposé ici.</p>}
      <div className="flex flex-wrap gap-3"><button disabled={pending} className="rounded-xl bg-accent px-4 py-2 font-semibold text-white disabled:opacity-50">{pending?'En cours…':'Enregistrer le brouillon'}</button>
        {editing && <button type="button" disabled={pending} onClick={reset} className="rounded-xl border px-4 py-2">Annuler la modification</button>}</div>
    </form>
    <form onSubmit={event=>{event.preventDefault();setQuery(search);setPage(1);}} className="flex flex-wrap items-end gap-3" aria-label="Filtrer les collaborations">
      <div><label htmlFor="deal-search" className="block text-sm font-semibold">Rechercher une marque</label><input id="deal-search" type="search" maxLength={100} value={search} onChange={event=>setSearch(event.target.value)} className={inputClass}/></div>
      <div><label htmlFor="deal-state" className="block text-sm font-semibold">État</label><select id="deal-state" value={state} onChange={event=>{setState(event.target.value);setPage(1);}} className={inputClass}><option value="all">Tous</option><option value="draft">Brouillons</option><option value="archived">Archivées</option></select></div>
      <button className="rounded-xl border bg-white px-4 py-2.5">Rechercher</button>
    </form>
    <p className="text-sm text-slate-600">Exporter les résultats filtrés (500 maximum) : {' '}{['json','csv','pdf'].map(format=><a key={format} href={'/api/brand-deals/export?'+new URLSearchParams({state,q:query,format})} className="mr-3 font-semibold text-accent underline">{format.toUpperCase()}</a>)}</p>
    {message && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{message}</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
    {loading?<p role="status">Chargement des collaborations…</p>:listing && <>
      {!listing.items.length?<p>Aucune collaboration sur cette page.</p>:<ul className="space-y-4">{listing.items.map(item=><li key={item.id} className="space-y-3 rounded-2xl border bg-white p-5">
        <h2 className="text-lg font-bold">{item.brand_name}</h2>
        <p className="text-sm">Du {item.start_date}{item.end_date?' au '+item.end_date:''} · {item.archived_at?'Archivée le '+new Date(item.archived_at).toLocaleString('fr-FR',{timeZone:'UTC'})+' UTC':'Brouillon'}</p>
        {(item.brand_deal_verifications??[]).length>0 && <ul className="space-y-1">{item.brand_deal_verifications?.map(link=><li key={link.verification_id}><Link className="break-all text-sm text-accent underline" href={'/dashboard/archive/'+link.verification_id}>Vérification {link.verification_id}</Link></li>)}</ul>}
        {item.archived_at?<><p className="break-all font-mono text-xs">SHA-256 : {item.hash_sha256}</p><details onToggle={event=>{if(event.currentTarget.open)void loadSnapshot(item.id);}}><summary className="cursor-pointer font-semibold">Données canoniques archivées</summary>{snapshots[item.id]?.loading?<p role="status">Chargement du snapshot…</p>:snapshots[item.id]?.error?<p role="alert">{snapshots[item.id]?.error}</p>:<><pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs">{snapshots[item.id]?.payload?JSON.stringify(snapshots[item.id]?.payload,null,2):'Snapshot non disponible pour cette archive historique.'}</pre><a href={'/api/brand-deals/'+item.id} target="_blank" rel="noreferrer" className="text-sm text-accent underline">Ouvrir le détail JSON (nouvel onglet)</a></>}</details></>:<div className="flex flex-wrap gap-3">
          <button type="button" disabled={pending} onClick={()=>edit(item)} aria-label={'Modifier '+item.brand_name} className="rounded-lg border px-3 py-2">Modifier</button>
          <button type="button" disabled={pending} id={'deal-archive-'+item.id} onClick={()=>setConfirmation({item,action:'archive'})} aria-label={'Archiver '+item.brand_name} className="rounded-lg border px-3 py-2">Archiver</button>
          <button type="button" disabled={pending} id={'deal-delete-'+item.id} onClick={()=>setConfirmation({item,action:'delete'})} aria-label={'Supprimer le brouillon '+item.brand_name} className="rounded-lg border border-red-300 px-3 py-2 text-red-700">Supprimer le brouillon</button>
        </div>}
      </li>)}</ul>}
      <nav aria-label="Pagination des collaborations" className="flex flex-wrap items-center gap-4">
        <button type="button" disabled={page===1||loading} onClick={()=>setPage(value=>value-1)} className="rounded-lg border px-3 py-2 disabled:opacity-50">Précédent</button>
        <span>Page {page} · {listing.total??'Nombre indisponible'} résultats</span>
        <button type="button" disabled={listing.total===null||page*listing.pageSize>=listing.total||loading} onClick={()=>setPage(value=>value+1)} className="rounded-lg border px-3 py-2 disabled:opacity-50">Suivant</button>
      </nav>
    </>}
    {confirmation && <section role="alertdialog" onKeyDown={event=>{if(event.key==='Escape'&&!pending)cancelConfirmation();}} aria-labelledby="deal-confirm-title" aria-describedby="deal-confirm-help" className="rounded-2xl border-2 border-indigo-400 bg-white p-6">
      <h2 id="deal-confirm-title" tabIndex={-1} className="text-xl font-bold">{confirmation.action==='archive'?'Archiver':'Supprimer le brouillon'} {confirmation.item.brand_name} ?</h2>
      <p id="deal-confirm-help" className="mt-2">{confirmation.action==='archive'?'La marque, les dates, les liens et le snapshot seront figés. L’horodatage interne et l’empreinte ne sont pas une signature qualifiée.':'Cette action supprime uniquement ce brouillon et ses liens. Les vérifications restent disponibles.'}</p>
      <div className="mt-4 flex gap-3"><button type="button" disabled={pending} onClick={()=>void confirmAction()} className="rounded-lg bg-accent px-4 py-2 font-semibold text-white">Confirmer</button><button type="button" disabled={pending} onClick={cancelConfirmation} className="rounded-lg border px-4 py-2">Annuler</button></div>
    </section>}
  </div>;
}
