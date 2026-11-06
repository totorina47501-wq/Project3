// Préparation sans IA, puis analyse multimodale uniquement sur demande explicite.
import { MediaLibrary } from '@/components/MediaLibrary';

export const dynamic = 'force-dynamic';
export default function MediaPage() {
  // Les variables du Worker restent disponibles même sans valeur publique au build.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  return <div className="mx-auto max-w-3xl space-y-6">
    <div>
      <p className="text-sm font-bold uppercase tracking-wide text-accent">Préparation sans crédit IA</p>
      <h1 className="mt-2 font-heading text-4xl font-bold">Vidéos et carrousels</h1>
      <p className="mt-3 text-slate-600">
        Prépare tes médias privés, puis choisis de les analyser avec Mia.
        La préparation et le contrôle automatique de la légende ne consomment aucun crédit OpenAI.
        L&apos;analyse IA se lance séparément, uniquement au clic sur « Analyser avec Mia ».
      </p>
    </div>
    <MediaLibrary supabaseUrl={supabaseUrl} supabaseAnonKey={supabaseAnonKey}
      processingEnabled={process.env.MEDIA_PROCESSING_ENABLED === 'true' && process.env.MEDIA_JOBS_SCHEMA_READY === 'true'} />
  </div>;
}
