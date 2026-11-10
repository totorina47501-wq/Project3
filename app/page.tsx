// Chemin : app/page.tsx
import Link from 'next/link';
import type { Metadata } from 'next';
import { BRAND } from '@/lib/branding';
import { openaiReadiness } from '@/lib/openai/config';
import { billingGate } from '@/lib/billing/config';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export const dynamic = 'force-dynamic';
export default function Home() {
  // La landing doit annoncer seulement les capacités effectivement disponibles.
  // Aucune clé ni secret ne sort vers le navigateur.
  const ai = openaiReadiness(process.env);
  const aiAvailable = ai.keyConfigured && ai.textEnabled;
  const commercial = billingGate(process.env).mode === 'live';
  return (
    <main className="min-h-screen overflow-hidden bg-slate-50">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="font-heading text-xl font-bold text-primary" aria-label="MentionCheck, accueil">
            <span className="mr-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-xl text-white">
              ✓
            </span>
            {BRAND.publicName}
          </Link>
          <div className="flex flex-wrap gap-2">
            <Link href="/login" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-white">
              Connexion
            </Link>
            <Link href="/register" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              Créer un compte
            </Link>
          </div>
        </header>
        <section className="mx-auto flex max-w-4xl flex-col items-center py-24 text-center sm:py-32">
          <span className="rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-accent">
            Conçu pour les créateurs français
          </span>
          <h1 className="mt-6 font-heading text-5xl font-bold leading-tight tracking-tight text-primary sm:text-7xl">
            {aiAvailable ? <>L&apos;IA qui check vos mentions légales </> :
              <>Repérez les mentions commerciales </>}
            <span className="text-accent">avant publication.</span>
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600">
            {aiAvailable ?
              'MentionCheck vous aide à relire vos publications et à identifier les mentions commerciales à clarifier.' :
              'Contrôlez gratuitement vos légendes grâce aux règles automatiques de transparence commerciale, sans utiliser de crédit IA.'}
          </p>
          <Link href="/register" className="mt-10 rounded-2xl bg-accent px-7 py-4 font-bold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700">
            Check ma publication
          </Link>
          {!aiAvailable && <p role="status" className="mt-5 max-w-2xl rounded-xl border border-amber-300 bg-amber-50 px-5 py-3 text-sm text-amber-950">
            Analyses IA, réécritures et assistant Mia temporairement indisponibles. Le contrôle de légende sans IA reste accessible.
          </p>}
          <p className="mt-5 text-sm text-slate-500">
            Une aide à la relecture, pas une certification juridique automatique.
          </p>
        </section>
        <section id="fonctionnement" className="grid gap-5 pb-20 md:grid-cols-3">
          {[
            { title: 'Mention', text: 'Repérez les indications commerciales qui doivent être clairement signalées.' },
            { title: 'Check', text: aiAvailable ?
                'Analysez une légende et consultez un score explicable.' :
                'Vérifiez les mentions d’une légende avec des règles automatiques explicables, sans IA.' },
            aiAvailable ?
              { title: 'IA', text: 'Des recommandations assistées par IA sont accessibles lorsque les capacités sont actives.' } :
              { title: 'Sans IA', text: 'Le contrôle déterministe reste accessible et ne consomme aucun crédit IA.' },
          ].map(({ title, text }) => (
            <article key={title} className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <h2 className="font-heading text-2xl font-bold text-primary">{title}</h2>
              <p className="mt-3 leading-7 text-slate-600">{text}</p>
            </article>
          ))}
        </section>
        <section aria-labelledby="pour-qui" className="pb-20">
          <div className="mx-auto max-w-3xl text-center">
            <h2 id="pour-qui" className="font-heading text-3xl font-bold text-primary sm:text-4xl">Pour qui est fait MentionCheck ?</h2>
            <p className="mt-4 leading-7 text-slate-600">
              Que vous soyez créateur de contenu, influenceur ou freelance, préparez vos publications
              sponsorisées avec davantage de clarté sur les mentions commerciales à afficher.
            </p>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {[
              { title: 'Créateurs de contenu', text: 'Relisez les légendes de vos collaborations avant de publier.' },
              { title: 'Influenceurs', text: 'Repérez les formulations commerciales ambiguës et les mentions à clarifier.' },
              { title: 'Freelances et studios', text: 'Préparez les textes de vos campagnes et gardez la validation finale.' },
            ].map(item => <article key={item.title} className="rounded-3xl border border-slate-200 bg-white p-7">
              <h3 className="font-heading text-xl font-bold text-primary">{item.title}</h3>
              <p className="mt-3 leading-7 text-slate-600">{item.text}</p>
            </article>)}
          </div>
        </section>
        <section aria-labelledby="offres" className="mb-16 rounded-3xl bg-indigo-50 px-6 py-10 text-center sm:px-10">
          <h2 id="offres" className="font-heading text-3xl font-bold text-primary">Des offres selon votre rythme</h2>
          <p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-600">
            {commercial ? 'Découvrez les abonnements mensuels Solo, Pro et Studio.' :
              'Découvrez les formules Solo, Pro et Studio. Les tarifs sont indicatifs et les abonnements payants ne sont pas encore ouverts.'}
          </p>
          <Link href="/tarifs" className="mt-6 inline-flex rounded-xl bg-primary px-6 py-3 font-semibold text-white hover:bg-slate-800">
            {commercial ? 'Comparer les tarifs' : 'Comparer les tarifs indicatifs'}
          </Link>
        </section>
        <footer className="border-t border-slate-200 py-7 text-center text-sm text-slate-500">
          <nav aria-label="Informations publiques" className="mb-4 flex flex-wrap justify-center gap-5">
            <Link href="/tarifs" className="underline hover:text-accent">{commercial ? 'Tarifs' : 'Tarifs indicatifs'}</Link>
            <Link href="/developpeurs" className="underline hover:text-accent">API Studio</Link>
            <Link href="/legal/confidentialite" className="underline hover:text-accent">Confidentialité</Link>
            <Link href="/legal/mentions-legales" className="underline hover:text-accent">Mentions légales</Link>
          </nav>
          © 2026 {BRAND.publicName} — {aiAvailable ? BRAND.tagline : 'Relecture des mentions commerciales avant publication'}
          <p className="mt-2 text-xs">{commercial ? 'Service de relecture, pas une certification juridique.' :
            'Plateforme en préparation commerciale. Aucun abonnement payant ouvert.'}</p>
        </footer>
      </div>
    </main>
  );
}
