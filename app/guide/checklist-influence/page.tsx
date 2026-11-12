import type { Metadata } from 'next';
import Link from 'next/link';
import { LEAD_MAGNET_SOURCES, LEAD_MAGNET_UPDATED_AT } from '@/lib/marketing/lead-magnet';
import { LeadFeedbackForm } from '@/components/LeadFeedbackForm';

export const metadata: Metadata = {
  title: 'Guide conformité influence — MentionCheck',
  description: 'Checklist publique MentionCheck pour préparer les mentions commerciales en influence avec sources officielles et limites explicites.',
  alternates: { canonical: '/guide/checklist-influence' },
};

const checklist = [
  'Identifier la contrepartie (paiement, cadeau, affiliation, voyage, mise à disposition).',
  'Rendre visible le caractère commercial pour le public sur le format final publié.',
  'Identifier clairement la marque ou l’annonceur concerné.',
  'Relire les affirmations produit et conserver les éléments de preuve utiles.',
  'Faire valider les cas incertains (secteur, audience, mineurs, droits, territorialité).',
];

export default function InfluenceChecklistPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Guide MentionCheck — phase 1 autonome</p>
          <h1 className="mt-3 font-heading text-4xl font-bold text-primary sm:text-5xl">Checklist conformité influence commerciale</h1>
          <p className="mt-4 text-base leading-7 text-slate-700">
            Information générale fondée sur des sources officielles consultées le {LEAD_MAGNET_UPDATED_AT}. Ce guide ne constitue pas un avis juridique ni une certification.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="/api/lead-magnet" download className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800">
              Télécharger la checklist (.txt)
            </a>
            <Link href="/register" className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-primary hover:bg-slate-100">
              Créer un compte et lancer un diagnostic
            </Link>
          </div>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="font-heading text-2xl font-bold text-primary">Points à vérifier avant publication</h2>
          <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-700">
            {checklist.map((item) => <li key={item} className="rounded-xl bg-slate-50 px-4 py-3">{item}</li>)}
          </ul>
          <p className="mt-5 text-sm text-slate-600">
            Si un point est ambigu, interrompez la diffusion et sollicitez une validation juridique adaptée à votre contexte.
          </p>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="font-heading text-2xl font-bold text-primary">Sources officielles</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-700">
            {LEAD_MAGNET_SOURCES.map((source) => <li key={source.url}>
              <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline decoration-slate-300 underline-offset-4 hover:text-accent">
                {source.label}
              </a>
              <p className="text-xs text-slate-500">Consulté le {source.checkedAt}</p>
            </li>)}
          </ul>
        </section>

        <LeadFeedbackForm origin="guide" />
      </div>
    </main>
  );
}
