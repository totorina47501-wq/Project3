// CTA bloqué par billingGate tant que les conditions Stripe Live ne sont pas attestées.
'use client';
import { useState } from 'react';
export function PricingCheckout({plan,mode='test'}: {plan:'solo'|'pro'|'studio';mode?:'test'|'live'}) {
  const [pending,setPending]=useState(false);
  const [message,setMessage]=useState('');
  async function start() {
    setPending(true);setMessage('');
    try {
      const response=await fetch('/api/stripe/checkout',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({plan}),
      });
      const data=await response.json() as {url?:string;error?:string};
      if(!response.ok||!data.url)throw new Error(data.error??'Checkout indisponible.');
      const url=new URL(data.url);
      if(url.protocol!=='https:' || url.hostname!=='checkout.stripe.com')
        throw new Error('Adresse de paiement inattendue.');
      window.location.assign(url.toString());
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Erreur de facturation.');
      setPending(false);
    }
  }
  return <div className="space-y-2">
    <button onClick={() => void start()} type="button" disabled={pending}
      className="w-full rounded-xl bg-accent px-4 py-3 font-bold text-white disabled:opacity-50">
      {pending?'Ouverture…':mode==='live'?'Souscrire maintenant':'Essayer le paiement Stripe test'}
    </button>
    {mode==='live'&&<p className="text-xs text-slate-600">Abonnement mensuel à reconduction automatique. Résiliation depuis Paramètres / Facturation ou auprès du support si l’accès est impossible. Droit de rétractation des consommateurs selon les conditions légales, en principe 14 jours. Consultez les <a href="/legal/cgu" className="underline">CGV, le formulaire de rétractation et les remboursements</a> avant de payer. Le consentement aux conditions est demandé lors du paiement sécurisé Stripe.</p>}
    {message&&<p role="alert" className="text-sm text-red-700">{message}</p>}
  </div>;
}
