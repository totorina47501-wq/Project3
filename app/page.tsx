// Chemin : app/page.tsx
import Link from 'next/link';
import { BRAND } from '@/lib/branding';

export default function Home() {
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
            L&apos;IA qui check vos mentions légales <span className="text-accent">avant publication.</span>
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600">
            Mia analyse vos légendes et images, explique les risques de transparence
            commerciale et propose une réécriture qui respecte votre style.
          </p>
          <Link href="/register" className="mt-10 rounded-2xl bg-accent px-7 py-4 font-bold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700">
            Check ma publication
          </Link>
          <p className="mt-5 text-sm text-slate-500">
            Une aide à la relecture, pas une certification juridique automatique.
          </p>
        </section>
        <section id="fonctionnement" className="grid gap-5 pb-20 md:grid-cols-3">
          {[
            { title: 'Mention', text: 'Repérez les indications commerciales qui doivent être clairement signalées.' },
            { title: 'Check', text: 'Analysez une légende et son visuel, et consultez un score explicable.' },
            { title: 'IA', text: 'Mia vous propose une réécriture fidèle à votre voix, sous votre contrôle.' },
          ].map(({ title, text }) => (
            <article key={title} className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <h2 className="font-heading text-2xl font-bold text-primary">{title}</h2>
              <p className="mt-3 leading-7 text-slate-600">{text}</p>
            </article>
          ))}
        </section>
        <footer className="border-t border-slate-200 py-6 text-center text-sm text-slate-500">
          © 2026 {BRAND.legalName} — {BRAND.tagline}
        </footer>
      </div>
    </main>
  );
}
