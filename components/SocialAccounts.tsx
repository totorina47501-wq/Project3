'use client';
import { useState, type FormEvent } from 'react';
import { platformLabels, type SocialAccount, type SocialDraft, SOCIAL_PAGE_SIZE } from '@/lib/social/model';

type Props={initialItems:SocialAccount[];initialTotal:number;initialUnavailable?:boolean;plan:string};
export function SocialAccounts({initialItems,initialTotal,initialUnavailable=false,plan}:Props){
  const [items,setItems]=useState(initialItems);
  const [total,setTotal]=useState(initialTotal);
  const [page,setPage]=useState(1);
  const [platform,setPlatform]=useState<SocialDraft['platform']>('instagram');
  const [handle,setHandle]=useState('');
  const [editing,setEditing]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [unavailable,setUnavailable]=useState(initialUnavailable);
  const [message,setMessage]=useState('');
  async function load(nextPage:number){
    const response=await fetch('/api/social-accounts?page='+nextPage,{cache:'no-store'});
    const body=await response.json() as {items?:SocialAccount[];total?:number;error?:string};
    if(!response.ok||!Array.isArray(body.items)||typeof body.total!=='number')throw new Error(body.error??'Liste indisponible.');
    setItems(body.items);setTotal(body.total);setPage(nextPage);setUnavailable(false);
  }
  async function changePage(nextPage:number){
    setBusy(true);setMessage('');
    try{await load(nextPage);}catch(error){setMessage(error instanceof Error?error.message:'Liste indisponible.');}
    finally{setBusy(false);}
  }
  async function save(event:FormEvent){
    event.preventDefault();setBusy(true);setMessage('');
    try{
      const response=await fetch('/api/social-accounts'+(editing?'/'+editing:''),{
        method:editing?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({platform,handle}),
      });
      const body=await response.json() as {error?:string};
      if(!response.ok)throw new Error(body.error??'Enregistrement indisponible.');
      setEditing(null);setHandle('');
      try{await load(1);setMessage('Déclaration enregistrée.');}
      catch{setUnavailable(true);setMessage('Déclaration enregistrée. Actualise la liste pour consulter le résultat.');}
    }catch(error){setMessage(error instanceof Error?error.message:'Enregistrement indisponible.');}
    finally{setBusy(false);}
  }
  async function remove(account:SocialAccount){
    setBusy(true);setMessage('');
    try{
      const response=await fetch('/api/social-accounts/'+account.id,{method:'DELETE'});
      const body=await response.json() as {error?:string};
      if(!response.ok)throw new Error(body.error??'Suppression de la déclaration indisponible.');
      if(editing===account.id){setEditing(null);setHandle('');}
      try{await load(items.length===1&&page>1?page-1:page);setMessage('Déclaration retirée.');}
      catch{setUnavailable(true);setMessage('Déclaration retirée. Actualise la liste pour consulter le résultat.');}
    }catch(error){setMessage(error instanceof Error?error.message:'Suppression de la déclaration indisponible.');}
    finally{setBusy(false);}
  }
  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6" aria-labelledby="social-heading">
    <h2 id="social-heading" className="font-heading text-xl font-bold">Mes comptes sociaux déclarés</h2>
    <p className="text-sm text-slate-600">Ajoute les noms de tes comptes pour organiser ton espace. Une déclaration manuelle ne connecte aucun réseau : aucun accès aux publications, aucune publication automatique et aucune autorisation OAuth.</p>
    <p className="text-sm font-semibold">{unavailable?'Inventaire momentanément indisponible':`${total} compte${total>1?'s':''} enregistré${total>1?'s':''}`}{plan==='solo'?' · Plan Solo : 3 comptes maximum.':''}</p>
    {unavailable&&<button type="button" disabled={busy} onClick={()=>void changePage(page)} className="rounded-lg border px-3 py-2">Actualiser la liste</button>}
    {!unavailable&&!items.length&&<p className="text-sm text-slate-500">Aucun compte déclaré pour le moment.</p>}
    <ul className="divide-y divide-slate-100">
      {items.map(account=><li key={account.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="min-w-0"><p className="break-all font-semibold">{platformLabels[account.platform]} · @{account.handle}</p>
          <p className="text-xs text-slate-500">{account.connection_kind==='manual'?'Déclaration manuelle · aucune connexion OAuth':account.connection_kind==='oauth'?'Connexion fournisseur : état non vérifié ici':'Compte historique · connexion non vérifiée'}</p></div>
        {account.connection_kind==='manual'&&<div className="flex gap-2 text-sm">
          <button type="button" disabled={busy} onClick={()=>{setEditing(account.id);setPlatform(account.platform);setHandle(account.handle);setMessage('');}} aria-label={'Modifier @'+account.handle} className="rounded-lg border px-3 py-2">Modifier</button>
          <button type="button" disabled={busy} onClick={()=>void remove(account)} aria-label={'Retirer la déclaration @'+account.handle} className="rounded-lg border px-3 py-2 text-red-700">Retirer</button>
        </div>}
      </li>)}
    </ul>
    {total>SOCIAL_PAGE_SIZE&&<nav aria-label="Pages des comptes déclarés" className="flex items-center gap-3 text-sm">
      <button type="button" disabled={busy||page===1} onClick={()=>void changePage(page-1)} className="rounded-lg border px-3 py-2 disabled:opacity-50">Précédent</button>
      <span>Page {page}</span>
      <button type="button" disabled={busy||page*SOCIAL_PAGE_SIZE>=total} onClick={()=>void changePage(page+1)} className="rounded-lg border px-3 py-2 disabled:opacity-50">Suivant</button>
    </nav>}
    <form onSubmit={event=>void save(event)} className="space-y-3 border-t pt-4">
      <h3 className="font-semibold">{editing?'Modifier la déclaration':'Déclarer un compte'}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm"><span>Réseau social</span><select value={platform} onChange={event=>setPlatform(event.target.value as SocialDraft['platform'])} disabled={busy} className="block w-full rounded-lg border p-2">
          {Object.entries(platformLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}
        </select></label>
        <label className="space-y-1 text-sm"><span>Nom du compte (sans lien)</span><input value={handle} onChange={event=>setHandle(event.target.value)} required maxLength={200} autoComplete="off" disabled={busy} className="block w-full rounded-lg border p-2" placeholder="@moncompte"/></label>
      </div>
      <div className="flex gap-3"><button disabled={busy||(!editing&&plan==='solo'&&total>=3)} className="rounded-xl bg-accent px-4 py-2 font-semibold text-white disabled:opacity-50">{busy?'Enregistrement…':editing?'Enregistrer':'Ajouter la déclaration'}</button>
        {editing&&<button type="button" disabled={busy} onClick={()=>{setEditing(null);setHandle('');}} className="rounded-xl border px-4 py-2">Annuler</button>}</div>
    </form>
    {message&&<p role="status" className="text-sm text-slate-700">{message}</p>}
    <p className="text-xs text-slate-500">Retirer une déclaration enlève uniquement ces métadonnées de MentionCheck. Cela ne supprime aucun compte sur le réseau social.</p>
  </section>;
}
