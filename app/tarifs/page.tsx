import type { Metadata } from 'next';
import Link from 'next/link';
import { billingGate } from '@/lib/billing/config';
import { BRAND } from '@/lib/branding';
import { PricingCheckout } from '@/components/PricingCheckout';

export const dynamic='force-dynamic';
export const metadata: Metadata={
  title:'Offres en préparation — MentionCheck',
  description:'Présentation indicative des forfaits MentionCheck avant commercialisation.',
  robots:{index:false,follow:false},
};
export default function PricingPage(){
  const stripe=billingGate(process.env);
  const plans=[
    {id:'solo',name:'Solo',price:BRAND.plans.solo.priceMonthlyEur,
      checks:30,rewrites:5,mia:20},
    {id:'pro',name:'Pro',price:BRAND.plans.pro.priceMonthlyEur,
      checks:500,rewrites:500,mia:300},
    {id:'studio',name:'Studio',price:BRAND.plans.studio.priceMonthlyEur,
      checks:2000,rewrites:2000,mia:1500},
  ] as const;
  return <main className="mx-auto min-h-screen max-w-6xl px-5 py-10">
    <Link href="/" className="font-heading text-xl font-bold text-primary">✓ MentionCheck</Link>
    <div className="mt-14 max-w-3xl">
      <p className="text-sm font-bold uppercase tracking-wide text-accent">Offres à venir</p>
      <h1 className="mt-2 font-heading text-4xl font-bold">Tarifs indicatifs</h1>
      <p className="mt-4 text-slate-600">
        Cette grille est préparatoire. Aucune offre payante n&apos;est commercialisée pour le moment.
        Les paiements, lorsqu&apos;ils sont activés ici, fonctionnent exclusivement en mode test.
      </p>
    </div>
    <div className="mt-10 grid gap-5 md:grid-cols-3">
      {plans.map((plan)=><section key={plan.id}
        className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <h2 className="font-heading text-2xl font-bold">{plan.name}</h2>
        <p className="mt-4 text-4xl font-extrabold">{plan.price} €<span className="text-base font-normal text-slate-500"> / mois*</span></p>
        <p className="mt-4 text-sm text-slate-600">{plan.checks} analyses IA,
          {plan.rewrites} réécritures, {plan.mia} questions Mia par mois.</p>
        <p className="mt-2 text-xs text-slate-500">
          L&apos;outil de règles seules ne déclenche aucun crédit OpenAI.
        </p>
        <div className="mt-7">
          {stripe.enabled&&plan.id!=='solo'
            ?<PricingCheckout plan={plan.id}/>
            :<p className="rounded-xl bg-slate-100 p-3 text-center text-sm text-slate-600">
              {plan.id==='solo'?'Compte de démonstration accessible gratuitement.'
                :'Ouverture des abonnements après validation.'}
            </p>}
        </div>
      </section>)}
    </div>
    <p className="mt-8 text-xs text-slate-500">
      *Prix et conditions indicatifs, non contractuels. Les fonctionnalités, quotas et obligations
      légales seront vérifiés avant toute vente.
    </p>
  </main>;
}
