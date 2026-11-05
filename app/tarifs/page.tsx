import type { Metadata } from 'next';
import Link from 'next/link';
import { billingGate } from '@/lib/billing/config';
import { BRAND } from '@/lib/branding';
import { PricingCheckout } from '@/components/PricingCheckout';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Tarifs indicatifs Solo, Pro et Studio — MentionCheck',
  description: 'Comparez les offres MentionCheck pour créateurs et studios. Tarifs indicatifs, abonnements non commercialisés.',
  robots: { index: false, follow: false },
};

const plans = [
  { id: 'solo', name: 'Solo', audience: 'Pour débuter sereinement', price: BRAND.plans.solo.priceMonthlyEur,
    checks: BRAND.plans.solo.checksMonthly, rewrites: BRAND.plans.solo.rewritesMonthly, mia: 20,
    highlights: ['Pour les créateurs indépendants', 'Jusqu’à 3 comptes sociaux', 'Vérifications avant publication'] },
  { id: 'pro', name: 'Pro', audience: 'Pour publier régulièrement', price: BRAND.plans.pro.priceMonthlyEur,
    checks: BRAND.plans.pro.fairUseChecksMonthly, rewrites: 500, mia: 300,
    highlights: ['Pour les créateurs actifs', 'Réécritures de contenus', 'Assistant Mia pour vos questions'] },
  { id: 'studio', name: 'Studio', audience: 'Pour les volumes importants', price: BRAND.plans.studio.priceMonthlyEur,
    checks: BRAND.plans.studio.fairUseChecksMonthly, rewrites: 2000, mia: 1500,
    highlights: ['Pour les équipes et studios', 'Volumes de vérification élevés', 'Accompagnement des workflows éditoriaux'] },
] as const;

const faq = [
  { q: 'Puis-je souscrire maintenant ?', a: 'Non. Les offres sont présentées à titre indicatif. Aucun abonnement payant n’est commercialisé actuellement.' },
  { q: 'Les prix et quotas sont-ils définitifs ?', a: 'Non. Les montants, quotas, conditions fiscales et fonctionnalités seront confirmés avant l’ouverture commerciale.' },
  { q: 'MentionCheck remplace-t-il un juriste ?', a: 'Non. MentionCheck aide à repérer et corriger des mentions commerciales ; ses résultats sont informatifs et ne constituent pas un avis juridique.' },
  { q: 'Le paiement est-il réel ?', a: 'Non. Les éventuels parcours Stripe disponibles sur cette page utilisent exclusivement le mode test.' },
] as const;

export default function PricingPage() {
  const stripe = billingGate(process.env);
  return <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 text-slate-900 sm:px-6 sm:py-12">
    <Link href="/" className="font-heading text-lg font-bold text-slate-900">✓ {BRAND.publicName}</Link>
    <header className="mx-auto mt-12 max-w-3xl text-center sm:mt-16">
      <p className="text-sm font-bold uppercase tracking-widest text-indigo-700">Offres en préparation</p>
      <h1 className="mt-4 font-heading text-4xl font-bold tracking-tight sm:text-5xl">Un forfait adapté à votre rythme de création</h1>
      <p className="mt-5 text-base leading-7 text-slate-600 sm:text-lg">
        Vérifiez vos mentions commerciales, préparez vos réécritures et posez vos questions à Mia.
        Comparez nos formules avant l’ouverture des abonnements.
      </p>
      <p className="mt-4 text-sm font-medium text-amber-800">Tarifs indicatifs : aucune offre payante n’est actuellement commercialisée.</p>
    </header>
    <div className="mt-12 grid gap-5 md:grid-cols-3">
      {plans.map(plan => <section key={plan.id} aria-labelledby={`plan-${plan.id}`}
        className={`flex flex-col rounded-3xl border p-6 shadow-sm sm:p-8 ${plan.id === 'pro' ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500' : 'border-slate-200 bg-white'}`}>
        {plan.id === 'pro' && <p className="mb-4 w-fit rounded-full bg-indigo-700 px-3 py-1 text-xs font-semibold text-white">Offre mise en avant</p>}
        <h2 id={`plan-${plan.id}`} className="font-heading text-2xl font-bold">{plan.name}</h2>
        <p className="mt-2 text-sm text-slate-600">{plan.audience}</p>
        <p className="mt-6 text-4xl font-bold tracking-tight">{plan.price} € <span className="text-base font-normal text-slate-600">/ mois*</span></p>
        <div className="mt-6 border-t border-slate-200 pt-5">
          <p className="text-sm font-semibold">Quotas mensuels indicatifs</p>
          <dl className="mt-3 space-y-3 text-sm">
            <div className="flex justify-between gap-3"><dt>Analyses IA</dt><dd className="font-semibold">{plan.checks.toLocaleString('fr-FR')}</dd></div>
            <div className="flex justify-between gap-3"><dt>Réécritures</dt><dd className="font-semibold">{plan.rewrites.toLocaleString('fr-FR')}</dd></div>
            <div className="flex justify-between gap-3"><dt>Questions Mia</dt><dd className="font-semibold">{plan.mia.toLocaleString('fr-FR')}</dd></div>
          </dl>
        </div>
        <ul className="mt-6 flex-1 space-y-3 text-sm text-slate-700">
          {plan.highlights.map(item => <li key={item} className="flex gap-2"><span aria-hidden="true" className="font-bold text-emerald-700">✓</span><span>{item}</span></li>)}
        </ul>
        <div className="mt-8">
          {stripe.enabled && (plan.id !== 'solo' || Boolean(stripe.priceSolo)) ? <PricingCheckout plan={plan.id} /> :
            <p className="rounded-xl bg-slate-100 px-4 py-3 text-center text-sm font-medium text-slate-700">
              {plan.id === 'solo' ? 'Démonstration gratuite disponible' : 'Abonnement bientôt disponible'}
            </p>}
        </div>
      </section>)}
    </div>
    <section className="mt-16 rounded-3xl bg-slate-50 p-6 sm:p-9" aria-labelledby="comparison-title">
      <h2 id="comparison-title" className="font-heading text-2xl font-bold">Comparer les offres</h2>
      <p className="mt-2 text-sm text-slate-600">Volumes prévisionnels par mois, susceptibles d’évoluer avant lancement.</p>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead><tr className="border-b border-slate-300"><th scope="col" className="py-3 pr-3">Fonctionnalité</th>{plans.map(p => <th scope="col" key={p.id} className="px-3 py-3">{p.name}</th>)}</tr></thead>
          <tbody>
            <tr className="border-b border-slate-200"><th scope="row" className="py-3 pr-3 font-medium">Analyses IA</th>{plans.map(p => <td key={p.id} className="px-3 py-3">{p.checks.toLocaleString('fr-FR')}</td>)}</tr>
            <tr className="border-b border-slate-200"><th scope="row" className="py-3 pr-3 font-medium">Réécritures</th>{plans.map(p => <td key={p.id} className="px-3 py-3">{p.rewrites.toLocaleString('fr-FR')}</td>)}</tr>
            <tr><th scope="row" className="py-3 pr-3 font-medium">Questions Mia</th>{plans.map(p => <td key={p.id} className="px-3 py-3">{p.mia.toLocaleString('fr-FR')}</td>)}</tr>
          </tbody>
        </table>
      </div>
    </section>
    <section className="mx-auto mt-16 max-w-3xl" aria-labelledby="faq-title">
      <h2 id="faq-title" className="font-heading text-2xl font-bold">Questions fréquentes</h2>
      <div className="mt-5 space-y-3">{faq.map(item => <details key={item.q} className="rounded-2xl border border-slate-200 bg-white p-5">
        <summary className="cursor-pointer font-semibold">{item.q}</summary>
        <p className="mt-3 text-sm leading-6 text-slate-600">{item.a}</p>
      </details>)}</div>
    </section>
    <footer className="mt-12 border-t border-slate-200 pt-6 text-sm leading-6 text-slate-600">
      <p>*Prix et quotas indicatifs, non contractuels. Conditions fiscales, fonctionnalités et limites à confirmer avant commercialisation.</p>
      <p className="mt-2">Les vérifications automatiques constituent une aide à la préparation des publications, pas une garantie de conformité juridique.</p>
      <Link href="/" className="mt-4 inline-block font-semibold text-indigo-700 underline underline-offset-4">Retour à l’accueil</Link>
    </footer>
  </main>;
}
