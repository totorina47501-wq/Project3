// Chemin : app/dashboard/mia/page.tsx
import { MiaChat } from '@/components/MiaChat';

export const dynamic = 'force-dynamic';
export default async function MiaPage({
  searchParams,
}: { searchParams: Promise<{ verificationId?: string }> }) {
  const params = await searchParams;
  const id = params.verificationId;
  const safeId = id && /^[0-9a-f-]{36}$/i.test(id) ? id : undefined;
  return (
    <div className="space-y-7">
      <div>
        <p className="text-sm font-bold uppercase tracking-wide text-accent">Ton copilote</p>
        <h1 className="mt-2 font-heading text-4xl font-bold">Parler avec Mia</h1>
        <p className="mt-2 text-slate-600">
          Pose une question sur la transparence commerciale. Tes conversations restent privées.
        </p>
      </div>
      <MiaChat initialVerificationId={safeId} />
    </div>
  );
}
