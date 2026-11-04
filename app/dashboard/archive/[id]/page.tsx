// Chemin : app/dashboard/archive/[id]/page.tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/security/auth';
import { checkLabel } from '@/lib/check-status';
import { violationSchema } from '@/lib/ai/schemas';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export default async function ArchiveDetail({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { user, client: supabase } = await requireUser();
  const { data: item, error } = await supabase.from('verifications')
    .select('id,platform,content_text,accepted_caption,ai_score,ai_risk_level,status,created_at,completed_at,hash_sha256,prompt_version,ai_explanation,media_type')
    .eq('id', id).eq('user_id', user.id).single();
  if (error || !item) notFound();
  const details = item.ai_explanation && typeof item.ai_explanation === 'object'
    ? item.ai_explanation as { violations?: unknown; analysisMode?: unknown; warnings?: unknown }
    : {};
  const parsed = z.array(violationSchema).max(50).safeParse(details.violations);
  const findings = parsed.success ? parsed.data : [];
  const mode = details.analysisMode === 'rules_only' ? 'Règles automatiques uniquement'
    : details.analysisMode === 'partial' ? 'Analyse partielle' : 'Analyse IA';
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link className="text-sm font-semibold text-accent underline" href="/dashboard/archive">
          Retour aux archives
        </Link>
        <h1 className="mt-4 font-heading text-3xl font-bold">Détail de la vérification</h1>
        <p className="mt-2 text-sm text-slate-600">
          {item.platform} · {new Date(item.created_at).toLocaleString('fr-FR')}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border bg-white p-5">
          <p className="text-sm text-slate-500">État</p>
          <p className="mt-2 text-xl font-bold">{checkLabel(item.status,item.ai_score)}</p>
        </article>
        <article className="rounded-2xl border bg-white p-5">
          <p className="text-sm text-slate-500">Mode d&apos;analyse</p>
          <p className="mt-2 text-xl font-bold">{mode}</p>
        </article>
      </div>
      <section className="rounded-2xl border bg-white p-6">
        <h2 className="font-heading text-xl font-bold">Publication originale</h2>
        <p className="mt-4 whitespace-pre-wrap break-words text-slate-800">{item.content_text}</p>
      </section>
      {item.accepted_caption && <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
        <h2 className="font-heading text-xl font-bold">Version acceptée</h2>
        <p className="mt-4 whitespace-pre-wrap break-words">{item.accepted_caption}</p>
      </section>}
      <section className="rounded-2xl border bg-white p-6">
        <h2 className="font-heading text-xl font-bold">Points contrôlés</h2>
        {!findings.length ? <p className="mt-3 text-sm text-slate-600">Aucun point enregistré.</p> :
          <ul className="mt-4 space-y-4">{findings.map((finding, i) =>
            <li key={finding.code + i} className="rounded-xl bg-slate-50 p-4">
              <p className="font-semibold">{finding.code} — {finding.title}</p>
              <p className="mt-2 text-sm">{finding.explanation}</p>
              <p className="mt-1 text-xs text-slate-500">{finding.source}</p>
            </li>)}</ul>}
        <p className="mt-4 text-xs text-slate-500">
          Ce contrôle n&apos;est pas une certification juridique. Version : {item.prompt_version}.
        </p>
      </section>
      <section className="rounded-2xl border bg-white p-6">
        <h2 className="font-heading text-xl font-bold">Empreinte de vérification</h2>
        <p className="mt-2 break-all font-mono text-xs">{item.hash_sha256 ?? 'Non disponible'}</p>
        <p className="mt-2 text-xs text-slate-500">
          SHA-256 des données canoniques du contrôle. Aucune signature qualifiée ni
          horodatage tiers n&apos;est inclus.
        </p>
      </section>
      <div className="flex flex-wrap gap-3">
        <a href={'/api/archive/' + id + '/pdf'}
          className="rounded-xl bg-accent px-5 py-3 font-bold text-white">
          Exporter le rapport PDF
        </a>
        <Link href={'/dashboard/mia?verificationId=' + id}
          className="rounded-xl border border-indigo-300 bg-white px-5 py-3 font-bold text-indigo-700">
          Poser une question à Mia
        </Link>
      </div>
    </div>
  );
}
