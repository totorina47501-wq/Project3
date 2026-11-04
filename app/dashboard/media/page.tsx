// Espace médias séparé des checks IA facturables.
import { MediaLibrary } from '@/components/MediaLibrary';

export const dynamic = 'force-dynamic';
export default function MediaPage() {
  return <div className="mx-auto max-w-3xl space-y-6">
    <div>
      <p className="text-sm font-bold uppercase tracking-wide text-accent">Sans crédit IA</p>
      <h1 className="mt-2 font-heading text-4xl font-bold">Vidéos et carrousels</h1>
      <p className="mt-3 text-slate-600">
        Prépare des médias privés en attendant l&apos;analyse multimodale.
        Aucun appel payant à OpenAI n&apos;est lancé.
      </p>
    </div>
    <MediaLibrary />
  </div>;
}
