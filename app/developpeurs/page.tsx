import Link from 'next/link';
import type { Metadata } from 'next';
import { billingGate } from '@/lib/billing/config';
export const dynamic='force-dynamic';
export function generateMetadata():Metadata {
 const live=billingGate(process.env).mode==='live';
 return {title:'API Studio et documentation développeurs — MentionCheck',
 description:'Intégrez les contrôles de mentions commerciales sans IA via l’API REST Studio MentionCheck, avec clés et scopes.',
 robots:{index:live,follow:live}};
}
export default function DevelopersPage(){
 const live=billingGate(process.env).mode==='live';
 return <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-900 sm:px-8">
  <div className="mx-auto max-w-5xl">
   <header className="flex flex-wrap items-center justify-between gap-4">
     <Link href="/" className="font-heading text-xl font-bold text-slate-900">✓ MentionCheck</Link>
     <Link href="/tarifs" className="rounded-xl border border-slate-200 px-4 py-2 font-semibold">Voir les offres</Link>
   </header>
   <section className="py-16 sm:py-24">
    <p className="font-semibold uppercase tracking-widest text-indigo-700">API REST · Studio</p>
    <h1 className="mt-4 max-w-3xl font-heading text-4xl font-bold tracking-tight sm:text-6xl">
      Vérifiez les mentions commerciales depuis vos outils.
    </h1>
    <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">
      Intégrez le contrôle textuel de MentionCheck dans vos workflows de rédaction,
      d’agence et de publication, grâce à une API JSON documentée et un SDK TypeScript.
      Le moteur repose sur des règles déterministes et n’effectue aucun appel IA.
    </p>
    {!live && <p role="status" className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
       API Studio en préparation commerciale. Les abonnements et l’accès commercial aux clés ne sont pas encore ouverts.
    </p>}
   </section>
   <section aria-label="Conditions API Studio" className="grid gap-4 md:grid-cols-3">
    {[
     {title:'Incluse dans Studio',body:'49 € / mois à titre indicatif ; non comprise dans Solo ou Pro.'},
     {title:'2 000 contrôles / mois',body:'Par espace, toutes clés confondues. Sans dépassement facturé. Renouvellement mensuel UTC.'},
     {title:'Clés et permissions',body:'Scopes checks:write et checks:read, rotation et révocation, expiration maximale de 90 jours.'},
    ].map(p=><article key={p.title} className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="font-heading text-xl font-bold">{p.title}</h2><p className="mt-3 text-slate-600">{p.body}</p>
    </article>)}
   </section>
   <section className="mt-12 grid gap-8 lg:grid-cols-2">
    <div>
      <h2 className="font-heading text-2xl font-bold">Contrôler une légende</h2>
      <p className="mt-3 leading-7 text-slate-600">Le serveur partenaire stocke la clé `mc_studio_...` dans ses secrets. Ne jamais exposer une clé dans un site public.</p>
      <p className="mt-3 text-sm text-slate-600">POST /api/v1/check · HTTPS · JSON · limites 64 Kio / 10 000 caractères.</p>
    </div>
    <pre className="overflow-x-auto rounded-2xl bg-slate-950 p-5 text-sm leading-6 text-slate-100"><code>{`curl -X POST \\
  'https://mentioncheck.toto-rina47501.workers.dev/api/v1/check' \\
  -H "Authorization: Bearer $MENTIONCHECK_API_KEY" \\
  -H 'Content-Type: application/json' \\
  --data '{"caption":"Publicité : partenariat rémunéré.","platform":"instagram"}'`}</code></pre>
   </section>
   <section className="mt-12 rounded-2xl border border-slate-200 bg-white p-7">
      <h2 className="font-heading text-2xl font-bold">Contrat et sécurité</h2>
      <p className="mt-3 text-slate-600">GET /api/v1/verifications renvoie les dernières vérifications du seul espace autorisé.
        Le serveur vérifie l’abonnement Studio, la validité et les droits de la clé.
        Limitation complémentaire de 120 requêtes par minute par clé ; refus HTTP 401, 403 ou 429.</p>
      <p className="mt-3 text-sm text-slate-600">Les résultats apportent une aide à la relecture et ne constituent pas une certification juridique.</p>
      <a href="https://github.com/totorina47501-wq/Project3/blob/main/docs/api/openapi.yaml"
        className="mt-5 inline-flex font-semibold text-indigo-800 underline">Consulter la spécification OpenAPI 3.1</a>
   </section>
   <footer className="mt-14 border-t border-slate-200 py-8 text-sm text-slate-500">
     <Link href="/" className="underline">Accueil</Link> · <Link href="/tarifs" className="underline">Tarifs indicatifs</Link>
   </footer>
  </div>
 </main>;
}
