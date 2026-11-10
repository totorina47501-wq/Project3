'use client';
import { useState } from 'react';

// Stripe Customer Portal est hébergé par Stripe : ne jamais suivre d'URL arbitraire.
export function BillingPortal({mode}:{mode:'test'|'live'}) {
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  async function openPortal() {
    setBusy(true);setMessage('');
    try {
      const response=await fetch('/api/stripe/portal',{method:'POST',headers:{'Content-Type':'application/json'}});
      const payload=await response.json() as {url?:string;error?:string};
      if(!response.ok || !payload.url)throw new Error(payload.error??'Portail indisponible.');
      const url=new URL(payload.url);
      if(url.protocol!=='https:' || url.hostname!=='billing.stripe.com')
        throw new Error('Destination de facturation inattendue.');
      window.location.assign(url.toString());
    }catch(error){
      setMessage(error instanceof Error?error.message:'Portail indisponible.');
      setBusy(false);
    }
  }
  return <div className="mt-5 space-y-2">
    <button type="button" disabled={busy} onClick={()=>void openPortal()}
      className="rounded-xl border border-indigo-600 px-4 py-3 font-semibold text-indigo-700 disabled:opacity-50">
      {busy?'Ouverture…':'Gérer mon abonnement et mes factures'}
    </button>
    {mode==='test'&&<p className="text-xs text-slate-500">Portail Stripe Sandbox : paiements simulés uniquement.</p>}
    {message&&<p role="alert" className="text-sm text-red-700">{message}</p>}
  </div>;
}
