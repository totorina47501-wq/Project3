import type { Metadata } from 'next';
import Link from 'next/link';
export const metadata: Metadata = {
  title:'Mentions légales en préparation — MentionCheck',
  robots:{index:false,follow:false},
};
export default function MentionsLegales() {
  return <main className="mx-auto max-w-3xl space-y-6 px-5 py-12 text-slate-800">
    <Link href="/" className="text-sm font-semibold text-indigo-700 underline">Accueil</Link>
    <h1 className="font-heading text-4xl font-bold">Mentions légales</h1>
    <p className="rounded-xl border border-amber-300 bg-amber-50 p-4">
      <strong>Version de prépublication.</strong> Les mentions obligatoires sont
      à renseigner et à faire valider avant toute commercialisation.
      L&apos;identité juridique de l&apos;éditeur n&apos;est pas encore fournie.
    </p>
    <h2 className="text-2xl font-bold">Éditeur</h2>
    <p>Nom commercial du produit : MentionCheck. Raison sociale, forme juridique,
      siège, immatriculation, contact officiel et responsable de publication :
      à compléter par l&apos;exploitant avant mise en production commerciale.
    </p>
    <h2 className="text-2xl font-bold">Hébergement technique</h2>
    <p>Application : Cloudflare Workers. Données d&apos;authentification
      et stockage : Supabase. Une liste formelle des sous-traitants doit
      être publiée après revue contractuelle.
    </p>
    <p>Pour consulter les informations relatives aux données personnelles,
      lire la <Link href="/legal/confidentialite" className="text-indigo-700 underline">
        page confidentialité provisoire
      </Link>.
    </p>
  </main>;
}
