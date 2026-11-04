'use client';
import { useState, type FormEvent } from 'react';
import type { RewriteTone } from '@/lib/social/model';
export function AIPreferences({initialTone='naturel',initialUnavailable=false}:{initialTone?:RewriteTone;initialUnavailable?:boolean}){
  const [tone,setTone]=useState(initialTone);
  const [saved,setSaved]=useState<RewriteTone|null>(initialUnavailable?null:initialTone);
  const [busy,setBusy]=useState(false);
  const [failed,setFailed]=useState(initialUnavailable);
  const [message,setMessage]=useState(initialUnavailable?'Préférence momentanément indisponible. Le ton naturel reste utilisé par défaut.':'');
  async function save(event:FormEvent){
    event.preventDefault();if(busy)return;setBusy(true);setMessage('');setFailed(false);
    try{
      const response=await fetch('/api/social-accounts/preferences',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({rewriteTone:tone})});
      const result=await response.json().catch(()=>({error:'Préférence momentanément indisponible. Réessaie dans un instant.'})) as {rewriteTone?:RewriteTone;error?:string};
      if(!response.ok||!result.rewriteTone)throw new Error(result.error??'Préférence indisponible.');
      setSaved(result.rewriteTone);setMessage('Tonalité enregistrée. Elle sera utilisée pour tes prochaines réécritures IA.');
    }catch(error){setFailed(true);setMessage(error instanceof Error?error.message:'Enregistrement indisponible.');}
    finally{setBusy(false);}
  }
  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6" aria-labelledby="tone-heading">
    <h2 id="tone-heading" className="font-heading text-xl font-bold">Tonalité des réécritures</h2>
    <p className="text-sm text-slate-600">Choisis le style de tes prochaines suggestions. Enregistrer ce choix ne lance aucune analyse ni réécriture et ne consomme aucun crédit IA.</p>
    <form onSubmit={event=>void save(event)} aria-busy={busy} className="flex flex-wrap items-end gap-3">
      <label className="space-y-1 text-sm"><span>Tonalité préférée</span><select value={tone} onChange={event=>setTone(event.target.value as RewriteTone)} disabled={busy} className="block rounded-lg border p-2">
        <option value="naturel">Naturel</option><option value="créatif">Créatif</option><option value="institutionnel">Institutionnel</option>
      </select></label>
      <button disabled={busy||saved===tone} className="rounded-xl bg-accent px-4 py-2 font-semibold text-white disabled:opacity-50">{busy?'Enregistrement…':'Enregistrer le ton'}</button>
    </form>
    {message&&<p role={failed?'alert':'status'} className="text-sm text-slate-700">{message}</p>}
  </section>;
}
