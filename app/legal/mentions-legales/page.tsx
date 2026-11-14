import type { Metadata } from 'next';
import Link from 'next/link';
import { BRAND } from '@/lib/branding';

export const metadata: Metadata = {
  title: 'Mentions légales — MentionCheck',
  description: 'Informations sur l’éditeur et les prestataires techniques de MentionCheck.',
  alternates: { canonical: '/legal/mentions-legales' },
};

export default function MentionsLegales() {
  return <main className="mx-auto max-w-3xl space-y-6 px-5 py-12 leading-relaxed text-slate-800">
    <Link href="/" className="text-sm font-semibold text-indigo-700 underline">Accueil</Link>
    <h1 className="font-heading text-4xl font-bold">Mentions légales</h1>
    <section className="space-y-3">
      <h2 className="font-heading text-2xl font-bold">Éditeur</h2>
      <p><strong>Éditeur :</strong> {BRAND.legalName} ({BRAND.tradeName})</p>
      <p><strong>Adresse :</strong> {BRAND.legalAddress}</p>
      <p><strong>SIRET déclaré par l’éditeur :</strong> {BRAND.siret}</p>
      <p><strong>TVA :</strong> {BRAND.vatNotice}</p>
      <p><strong>Contact :</strong>{' '}
        <a href={`mailto:${BRAND.contactEmail}`} className="text-indigo-700 underline">{BRAND.contactEmail}</a>
        {' — '}<a href="tel:+33675814948" className="text-indigo-700 underline">{BRAND.contactPhone}</a>
      </p>
      <p><strong>Directeur de la publication :</strong> {BRAND.publicationDirector}</p>
    </section>
    <section className="space-y-3">
      <h2 className="font-heading text-2xl font-bold">Hébergement et prestataires techniques</h2>
      <p><strong>Cloudflare, Inc.</strong> — hébergement de l’application.</p>
      <p>101 Townsend Street, San Francisco, CA 94107, États-Unis.</p>
      <p>+1 650 319 8930 — <a href="https://www.cloudflare.com" className="text-indigo-700 underline">www.cloudflare.com</a></p>
      <p><strong>Supabase</strong> — authentification, base de données et stockage —{' '}
        <a href="https://supabase.com" className="text-indigo-700 underline">supabase.com</a>.
      </p>
    </section>
    <section className="space-y-3">
      <h2 className="font-heading text-2xl font-bold">Données personnelles</h2>
      <p>Consultez la <Link href="/legal/confidentialite" className="text-indigo-700 underline">politique de confidentialité</Link>.
        Pour exercer vos droits, contactez{' '}
        <a href={`mailto:${BRAND.contactEmail}`} className="text-indigo-700 underline">{BRAND.contactEmail}</a>.
      </p>
    </section>
  </main>;
}
