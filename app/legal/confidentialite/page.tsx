import type { Metadata } from 'next';
import Link from 'next/link';
export const metadata: Metadata = {
  title:'Confidentialité — MentionCheck (prépublication)',
  robots:{ index:false, follow:false },
};
export default function Confidentialite() {
  return <main className="mx-auto max-w-3xl space-y-6 px-5 py-12 leading-relaxed text-slate-800">
    <Link href="/" className="text-sm font-semibold text-indigo-700 underline">Retour à MentionCheck</Link>
    <h1 className="font-heading text-4xl font-bold">Confidentialité — version de préparation</h1>
    <p role="note" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
      Document provisoire : le responsable de traitement, les coordonnées de contact,
      les durées définitives de conservation et les contrats de sous-traitance doivent
      être validés avant la commercialisation. Cette page n&apos;est pas une politique RGPD finalisée.
    </p>
    <h2 className="text-2xl font-bold">Données utilisées</h2>
    <p>Lors d&apos;une connexion, MentionCheck utilise un identifiant, une adresse email
      et des cookies de session. Les contrôles enregistrent la légende,
      les résultats et leurs dates. Les discussions Mia, versions acceptées et fichiers
      préparés sont accessibles uniquement au propriétaire authentifié.
    </p>
    <h2 className="text-2xl font-bold">Utilisation de l&apos;IA</h2>
    <p>Le mode « sans IA » n&apos;envoie aucun contenu à OpenAI. Si l&apos;utilisateur
      choisit expressément l&apos;analyse IA ou le chat Mia, le contenu nécessaire
      peut être transmis au fournisseur API pour traiter la demande.
      L&apos;option facultative de réutilisation interne des réécritures est
      désactivée par défaut et révocable depuis les paramètres.
    </p>
    <h2 className="text-2xl font-bold">Hébergement et sous-traitants</h2>
    <p>Le service utilise Cloudflare Workers pour l&apos;application,
      Supabase pour l&apos;authentification et les données privées,
      ainsi que l&apos;API OpenAI uniquement lors des appels IA.
      Les modalités de transferts internationaux et contrats de sous-traitance
      nécessitent une vérification avant commercialisation.
    </p>
    <h2 className="text-2xl font-bold">Export et effacement</h2>
    <p>L&apos;utilisateur authentifié peut exporter les données structurées
      disponibles depuis Paramètres et modifier sa préférence relative à
      la réutilisation. Cet export n&apos;inclut pas les octets des fichiers privés.
      Le mécanisme de suppression intégrale, notamment des fichiers et données
      chez les prestataires, n&apos;est pas encore déployé.
    </p>
    <h2 className="text-2xl font-bold">Conservation</h2>
    <p>Les fichiers médias préparés portent des échéances logiques de conservation ;
      leur purge physique automatique doit encore être mise en place.
      Les vérifications et conversations restent stockées jusqu&apos;à la mise
      en œuvre d&apos;un mécanisme complet de suppression ou d&apos;une demande traitée.
      Aucune durée réglementaire universelle n&apos;est affirmée ici.
    </p>
  </main>;
}
