import type { Metadata } from 'next';
import Link from 'next/link';
export const metadata: Metadata = {
  title:'Conditions de service — projet MentionCheck',
  robots:{index:false,follow:false},
};
export default function Terms() {
  return <main className="mx-auto max-w-3xl space-y-6 px-5 py-12 text-slate-800">
    <Link href="/" className="text-sm font-semibold text-indigo-700 underline">Accueil</Link>
    <h1 className="font-heading text-4xl font-bold">Conditions d&apos;utilisation — brouillon</h1>
    <p role="note" className="rounded-xl border border-amber-300 bg-amber-50 p-4">
      Ce document n&apos;est pas une version contractuelle approuvée.
      Les clauses définitives nécessitent l&apos;identité juridique de
      l&apos;éditeur et une revue professionnelle préalable.
    </p>
    <h2 className="text-2xl font-bold">Nature du service</h2>
    <p>MentionCheck est un outil d&apos;assistance à la relecture des publications
      commerciales. Ses scores, recommandations et réponses IA ne sont pas
      une certification de conformité ni une consultation juridique individualisée.
    </p>
    <h2 className="text-2xl font-bold">Contrôle des dépenses IA</h2>
    <p>Le mode sans IA ne consomme pas de crédits OpenAI.
      Les fonctions IA exigent un choix explicite et peuvent
      être soumises à des quotas. Les vidéos préparées ne sont
      pas encore analysées automatiquement.
    </p>
    <h2 className="text-2xl font-bold">Données</h2>
    <p>Les fichiers sont conservés dans un espace privé.
      Les mécanismes d&apos;export et de suppression doivent être
      revus et complétés avant commercialisation. Consulter la
      <Link href="/legal/confidentialite" className="ml-1 text-indigo-700 underline">
        page de confidentialité
      </Link>.
    </p>
  </main>;
}
