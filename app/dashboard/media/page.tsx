// Espace médias séparé des checks IA facturables.
import { MediaLibrary } from '@/components/MediaLibrary';

export const dynamic = 'force-dynamic';
export default function MediaPage() {
  // Worker runtime bindings are available here even when NEXT_PUBLIC values were
  // not embedded in the browser bundle at Cloudflare build time.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  return <div className="mx-auto max-w-3xl space-y-6">
    <div>
      <p className="text-sm font-bold uppercase tracking-wide text-accent">Sans crédit IA</p>
      <h1 className="mt-2 font-heading text-4xl font-bold">Vidéos et carrousels</h1>
      <p className="mt-3 text-slate-600">
        Prépare des médias privés en attendant l&apos;analyse multimodale.
        Aucun appel payant à OpenAI n&apos;est lancé.
      </p>
    </div>
    <MediaLibrary supabaseUrl={supabaseUrl} supabaseAnonKey={supabaseAnonKey} />
  </div>;
}
