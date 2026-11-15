'use client';
import { useEffect,useRef,useState,type FormEvent } from 'react';
import Link from 'next/link';
import { createCreatorProposal,creatorMediaKitSchema,type CreatorDetails,type DealRecord } from '@/lib/brand-deals/model';

type Listing={items:DealRecord[];total:number|null;page:number;pageSize:number;error?:string};
type FormValues={brand_name:string;start_date:string;end_date:string;contract_url:string;verification_ids:string;creator_details:CreatorDetails};
type MediaKitForm={
  creator_name:string;description:string;niches:string;formats:string;public_links:string;contact_email:string;contact_url:string;
  include_creator_name:boolean;include_description:boolean;include_niches:boolean;include_formats:boolean;
  include_public_links:boolean;include_contact_email:boolean;include_contact_url:boolean;
};
const emptyDetails=():CreatorDetails=>({niche:'',platform:'',format:'',deliverables:'',duration:'',budget:'',reuse_rights:'',exclusivity:'',proposal:''});
const emptyForm=():FormValues=>({brand_name:'',start_date:new Date().toISOString().slice(0,10),end_date:'',contract_url:'',verification_ids:'',creator_details:emptyDetails()});
const emptyMediaKit=():MediaKitForm=>({
  creator_name:'',description:'',niches:'',formats:'',public_links:'',contact_email:'',contact_url:'',
  include_creator_name:true,include_description:true,include_niches:true,include_formats:true,
  include_public_links:true,include_contact_email:false,include_contact_url:false,
});
type MediaKitExportResult={status:'invalid'|'cancelled'|'failed'}|{status:'download';blob:Blob};
export async function requestCreatorMediaKitPdf(
  mediaKit:MediaKitForm,signal:AbortSignal,fetcher:typeof fetch=fetch,
):Promise<MediaKitExportResult> {
  const splitLines=(value:string)=>value.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  const parsed=creatorMediaKitSchema.safeParse({
    creator_name:mediaKit.creator_name,
    description:mediaKit.description,
    niches:splitLines(mediaKit.niches),
    formats:splitLines(mediaKit.formats),
    public_links:splitLines(mediaKit.public_links),
    contact_email:mediaKit.contact_email,
    contact_url:mediaKit.contact_url,
    include_creator_name:mediaKit.include_creator_name,
    include_description:mediaKit.include_description,
    include_niches:mediaKit.include_niches,
    include_formats:mediaKit.include_formats,
    include_public_links:mediaKit.include_public_links,
    include_contact_email:mediaKit.include_contact_email,
    include_contact_url:mediaKit.include_contact_url,
  });
  if(!parsed.success)return {status:'invalid'};
  try {
    const response=await fetcher('/api/brand-deals/export',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(parsed.data),signal,
    });
    if(signal.aborted)return {status:'cancelled'};
    if(!response.ok)return {status:'failed'};
    const blob=await response.blob();
    return signal.aborted?{status:'cancelled'}:{status:'download',blob};
  }catch {
    return signal.aborted?{status:'cancelled'}:{status:'failed'};
  }
}
const briefChecks=[
  'Rémunération et échéances',
  'Livrables et formats attendus',
  'Usages et durée des droits sur les contenus',
  'Durée de la collaboration',
  'Exclusivité et périmètre',
  'Mentions commerciales demandées',
  'Calendrier et dates de validation',
  'Modalités et délai de paiement',
];
export function BrandDeals() {
  const [form,setForm]=useState<FormValues>(emptyForm);
  const [mediaKit,setMediaKit]=useState<MediaKitForm>(emptyMediaKit);
  const [briefText,setBriefText]=useState('');
  const [mediaKitError,setMediaKitError]=useState('');
  const [mediaKitMessage,setMediaKitMessage]=useState('');
  const [mediaKitPending,setMediaKitPending]=useState(false);
  const mediaKitAbortRef=useRef<AbortController|null>(null);
  const mediaKitErrorRef=useRef<HTMLParagraphElement>(null);
  const mediaKitMessageRef=useRef<HTMLParagraphElement>(null);
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
  useEffect(()=>{
    if(mediaKitError)mediaKitErrorRef.current?.focus();
    else if(mediaKitMessage)mediaKitMessageRef.current?.focus();
  },[mediaKitError,mediaKitMessage]);
  function cancelConfirmation() {
    if(confirmation)document.getElementById('deal-'+confirmation.action+'-'+confirmation.item.id)?.focus();
    setConfirmation(null);
  }
  function change(key:Exclude<keyof FormValues,'creator_details'>,value:string){setForm(previous=>({...previous,[key]:value}));}
  function changeDetail<K extends keyof CreatorDetails>(key:K,value:CreatorDetails[K]){setForm(previous=>({...previous,creator_details:{...previous.creator_details,[key]:value}}));}
  function changeMediaKit<K extends keyof MediaKitForm>(key:K,value:MediaKitForm[K]){setMediaKit(previous=>({...previous,[key]:value}));}
  function reset(){setForm(emptyForm());setEditing(null);}
  async function save(event:FormEvent) {
    event.preventDefault();setPending(true);setError('');setMessage('');
    try {
      const response=await fetch('/api/brand-deals'+(editing?'/'+editing:''),{
        method:editing?'PATCH':'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...form,end_date:form.end_date||null,contract_url:form.contract_url||null,
          creator_details:Object.values(form.creator_details).some(value=>value.trim())?form.creator_details:null,
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
    setEditing(item.id);setForm({brand_name:item.brand_name,start_date:item.start_date,end_date:item.end_date??'',contract_url:item.contract_url??'',verification_ids:(item.brand_deal_verifications??[]).map(link=>link.verification_id).join('\n'),creator_details:item.creator_details??emptyDetails()});
    document.getElementById('deal-brand')?.focus();
  }
  function generateProposal() {
    changeDetail('proposal',createCreatorProposal(form.creator_details));
  }
  async function downloadMediaKit() {
    const controller=new AbortController();
    mediaKitAbortRef.current=controller;
    setMediaKitPending(true);setMediaKitError('');
    setMediaKitMessage('');
    try {
      const result=await requestCreatorMediaKitPdf(mediaKit,controller.signal);
      if(result.status==='invalid') {
        setMediaKitError('Vérifie les champs, les adresses email et les liens HTTPS du kit.');
      }else if(result.status==='cancelled') {
        setMediaKitMessage('Téléchargement annulé.');
      }else if(result.status==='failed') {
        setMediaKitError('Téléchargement impossible. Vérifie ta connexion et réessaie.');
      }else if(result.status==='download') {
        const href=URL.createObjectURL(result.blob);
        const link=document.createElement('a');link.href=href;link.download='media-kit-createur.pdf';link.click();
        window.setTimeout(()=>URL.revokeObjectURL(href),1000);
        setMediaKitMessage('Téléchargement du PDF lancé.');
      }
    }catch{setMediaKitError('Téléchargement impossible. Vérifie ta connexion et réessaie.');}
    finally{
      if(mediaKitAbortRef.current===controller)mediaKitAbortRef.current=null;
      setMediaKitPending(false);
    }
  }
  function cancelMediaKitDownload(){mediaKitAbortRef.current?.abort();}
  const inputClass='mt-1 w-full rounded-lg border border-slate-300 p-2.5';
  return <div className="space-y-6">
    <form onSubmit={save} className="space-y-4 rounded-2xl border bg-white p-6" aria-labelledby="deal-form-title">
      <h2 id="deal-form-title" className="text-xl font-bold">{editing?'Modifier le brouillon':'Ma première collaboration'}</h2>
      <p className="text-sm text-slate-600">Prépare un projet sans engagement. Les éléments ci-dessous restent des brouillons modifiables ; aucun message n’est envoyé.</p>
      <div><label htmlFor="deal-brand" className="font-semibold">Marque</label><input id="deal-brand" required maxLength={200} value={form.brand_name} onChange={event=>change('brand_name',event.target.value)} className={inputClass}/></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label htmlFor="deal-start">Date de début</label><input id="deal-start" type="date" required value={form.start_date} onChange={event=>change('start_date',event.target.value)} className={inputClass}/></div>
        <div><label htmlFor="deal-end">Date de fin (facultatif)</label><input id="deal-end" type="date" min={form.start_date} value={form.end_date} onChange={event=>change('end_date',event.target.value)} className={inputClass}/></div>
      </div>
      <fieldset className="space-y-4 rounded-xl border p-4">
        <legend className="px-2 font-semibold">Proposition de collaboration</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label htmlFor="creator-niche">Activité ou niche</label><input id="creator-niche" maxLength={120} value={form.creator_details.niche} onChange={event=>changeDetail('niche',event.target.value)} className={inputClass}/></div>
          <div><label htmlFor="creator-platform">Plateforme</label><select id="creator-platform" value={form.creator_details.platform} onChange={event=>changeDetail('platform',event.target.value as CreatorDetails['platform'])} className={inputClass}><option value="">À préciser</option><option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="youtube">YouTube</option><option value="linkedin">LinkedIn</option><option value="other">Autre</option></select></div>
          <div><label htmlFor="creator-format">Format proposé</label><input id="creator-format" maxLength={100} value={form.creator_details.format} onChange={event=>changeDetail('format',event.target.value)} className={inputClass}/></div>
          <div><label htmlFor="creator-duration">Durée envisagée</label><input id="creator-duration" maxLength={120} value={form.creator_details.duration} onChange={event=>changeDetail('duration',event.target.value)} className={inputClass}/></div>
          <div><label htmlFor="creator-budget">Budget déclaré par toi</label><input id="creator-budget" maxLength={120} value={form.creator_details.budget} onChange={event=>changeDetail('budget',event.target.value)} className={inputClass}/></div>
          <div><label htmlFor="creator-reuse">Droits de réutilisation envisagés</label><input id="creator-reuse" maxLength={200} value={form.creator_details.reuse_rights} onChange={event=>changeDetail('reuse_rights',event.target.value)} className={inputClass}/></div>
        </div>
        <div><label htmlFor="creator-deliverables">Livrables envisagés</label><textarea id="creator-deliverables" rows={3} maxLength={1000} value={form.creator_details.deliverables} onChange={event=>changeDetail('deliverables',event.target.value)} className={inputClass}/></div>
        <div><label htmlFor="creator-exclusivity">Exclusivité éventuelle</label><textarea id="creator-exclusivity" rows={2} maxLength={200} value={form.creator_details.exclusivity} onChange={event=>changeDetail('exclusivity',event.target.value)} className={inputClass}/></div>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2"><label htmlFor="creator-proposal" className="font-semibold">Message de prise de contact — brouillon modifiable</label><button type="button" onClick={generateProposal} className="rounded-lg border px-3 py-2">Générer un modèle déterministe</button></div>
          <textarea id="creator-proposal" rows={8} maxLength={2500} value={form.creator_details.proposal} onChange={event=>changeDetail('proposal',event.target.value)} className={inputClass}/>
          <p className="text-sm text-slate-600">Le texte n’est jamais envoyé automatiquement et ne constitue pas un accord.</p>
        </div>
      </fieldset>
      <div><label htmlFor="deal-verifications">Identifiants de tes vérifications (facultatif, 50 maximum)</label>
        <textarea id="deal-verifications" rows={3} value={form.verification_ids} onChange={event=>change('verification_ids',event.target.value)} aria-describedby="deal-verification-help" className={inputClass}/>
        <p id="deal-verification-help" className="mt-1 text-sm text-slate-600">Un UUID par ligne, disponible dans l’adresse du détail des <Link href="/dashboard/archive" className="underline">vérifications</Link>. Elles doivent être finalisées avant l’archivage.</p>
      </div>
      {form.contract_url && <p className="text-sm text-slate-600">Contrat privé conservé : <code className="break-all">{form.contract_url}</code>. Aucun téléversement de contrat n’est proposé ici.</p>}
      <div className="flex flex-wrap gap-3"><button disabled={pending} className="rounded-xl bg-accent px-4 py-2 font-semibold text-white disabled:opacity-50">{pending?'En cours…':'Enregistrer le brouillon'}</button>
        {editing && <button type="button" disabled={pending} onClick={reset} className="rounded-xl border px-4 py-2">Annuler la modification</button>}</div>
    </form>
    <section className="space-y-4 rounded-2xl border bg-white p-6" aria-labelledby="creator-brief-title">
      <h2 id="creator-brief-title" className="text-xl font-bold">Questions à vérifier dans un brief ou contrat</h2>
      <p className="text-sm text-slate-600">Tu peux coller un extrait pour le relire ici ; il reste dans cette page et n’est ni envoyé ni analysé par une IA. Cette checklist est informative et ne remplace pas un conseil juridique. Aucune source juridique n’est citée sans récupération validée.</p>
      <label htmlFor="creator-brief" className="font-semibold">Extrait facultatif (12 000 caractères maximum)</label>
      <textarea id="creator-brief" rows={5} maxLength={12000} value={briefText} onChange={event=>setBriefText(event.target.value)} className={inputClass}/>
      <p className="text-right text-sm text-slate-600">{briefText.length}/12 000</p>
      <ul className="grid gap-2 sm:grid-cols-2">{briefChecks.map(question=><li key={question}>
        <label className="flex items-start gap-2 rounded-lg border p-3"><input type="checkbox" className="mt-1" aria-label={'Point vérifié : '+question}/><span>As-tu clarifié : {question.toLowerCase()} ?</span></label>
      </li>)}</ul>
    </section>
    <section className="space-y-4 rounded-2xl border bg-white p-6" aria-labelledby="media-kit-title" aria-busy={mediaKitPending}>
      <h2 id="media-kit-title" className="text-xl font-bold">Créer mon media kit PDF</h2>
      <p className="text-sm text-slate-600">Renseigne uniquement les informations que tu souhaites partager. Aucune statistique, audience, portée, performance, collaboration passée ou attestation n’est inventée ou ajoutée au PDF.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label htmlFor="kit-name">Nom ou nom de créateur</label><input id="kit-name" maxLength={120} value={mediaKit.creator_name} onChange={event=>changeMediaKit('creator_name',event.target.value)} className={inputClass}/><label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={mediaKit.include_creator_name} onChange={event=>changeMediaKit('include_creator_name',event.target.checked)}/>Inclure le nom dans le PDF</label></div>
        <div><label htmlFor="kit-description">Description</label><textarea id="kit-description" rows={3} maxLength={1200} value={mediaKit.description} onChange={event=>changeMediaKit('description',event.target.value)} className={inputClass}/><label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={mediaKit.include_description} onChange={event=>changeMediaKit('include_description',event.target.checked)}/>Inclure la description dans le PDF</label></div>
        <div><label htmlFor="kit-niches">Niches (une par ligne, 10 maximum)</label><textarea id="kit-niches" rows={3} maxLength={1000} value={mediaKit.niches} onChange={event=>changeMediaKit('niches',event.target.value)} className={inputClass}/><label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={mediaKit.include_niches} onChange={event=>changeMediaKit('include_niches',event.target.checked)}/>Inclure les niches dans le PDF</label></div>
        <div><label htmlFor="kit-formats">Formats proposés (un par ligne, 10 maximum)</label><textarea id="kit-formats" rows={3} maxLength={1000} value={mediaKit.formats} onChange={event=>changeMediaKit('formats',event.target.value)} className={inputClass}/><label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={mediaKit.include_formats} onChange={event=>changeMediaKit('include_formats',event.target.checked)}/>Inclure les formats dans le PDF</label></div>
        <div><label htmlFor="kit-links">Liens publics HTTPS (un par ligne, 10 maximum)</label><textarea id="kit-links" rows={3} maxLength={5000} value={mediaKit.public_links} onChange={event=>changeMediaKit('public_links',event.target.value)} className={inputClass}/><label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={mediaKit.include_public_links} onChange={event=>changeMediaKit('include_public_links',event.target.checked)}/>Inclure les liens dans le PDF</label></div>
        <div className="space-y-3">
          <div><label htmlFor="kit-email">Email de contact choisi</label><input id="kit-email" type="email" maxLength={254} value={mediaKit.contact_email} onChange={event=>changeMediaKit('contact_email',event.target.value)} className={inputClass}/><label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={mediaKit.include_contact_email} onChange={event=>changeMediaKit('include_contact_email',event.target.checked)}/>Inclure l’email dans le PDF</label></div>
          <div><label htmlFor="kit-contact-url">Site ou lien de contact HTTPS</label><input id="kit-contact-url" type="url" maxLength={500} value={mediaKit.contact_url} onChange={event=>changeMediaKit('contact_url',event.target.value)} className={inputClass}/><label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={mediaKit.include_contact_url} onChange={event=>changeMediaKit('include_contact_url',event.target.checked)}/>Inclure le lien de contact dans le PDF</label></div>
        </div>
      </div>
      {mediaKitError&&<p ref={mediaKitErrorRef} tabIndex={-1} role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{mediaKitError}</p>}
      <p ref={mediaKitMessageRef} tabIndex={mediaKitMessage?-1:undefined} role="status" aria-live="polite" aria-atomic="true">
        {mediaKitPending?'Préparation du PDF…':mediaKitMessage}
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={mediaKitPending} onClick={()=>void downloadMediaKit()} className="rounded-xl bg-accent px-4 py-2 font-semibold text-white disabled:opacity-50">{mediaKitPending?'Préparation…':'Télécharger mon media kit PDF'}</button>
        {mediaKitPending&&<button type="button" onClick={cancelMediaKitDownload} className="rounded-xl border px-4 py-2">Annuler le téléchargement</button>}
      </div>
    </section>
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
        {item.creator_details&&<details><summary className="cursor-pointer font-semibold">Voir les détails de la proposition</summary><dl className="mt-2 space-y-2 text-sm">
          {([
            ['Activité ou niche',item.creator_details.niche],
            ['Plateforme',item.creator_details.platform],
            ['Format',item.creator_details.format],
            ['Livrables',item.creator_details.deliverables],
            ['Durée',item.creator_details.duration],
            ['Budget déclaré',item.creator_details.budget],
            ['Droits de réutilisation',item.creator_details.reuse_rights],
            ['Exclusivité',item.creator_details.exclusivity],
          ] as const).filter(([,value])=>value).map(([label,value])=><div key={label}><dt className="font-semibold">{label}</dt><dd className="whitespace-pre-wrap break-words">{value}</dd></div>)}
          {item.creator_details.proposal&&<div><dt className="font-semibold">Message de prise de contact — brouillon</dt><dd className="whitespace-pre-wrap break-words">{item.creator_details.proposal}</dd></div>}
        </dl></details>}
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
