// Chemin : app/api/archive/[id]/pdf/route.ts
// Export serveur strictement limité au propriétaire de la vérification.
import { requireUser, HttpError, publicError } from '@/lib/security/auth';
import { buildArchivePdf } from '@/lib/archive/pdf';
import { z } from 'zod';
import { logServerError } from '@/lib/security/logging';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const idSchema = z.string().uuid();
const findingsSchema = z.array(z.object({
  code: z.string(), title: z.string(), explanation: z.string(), source: z.string(),
})).max(50);

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, client } = await requireUser();
    const { id } = await params;
    if (!idSchema.safeParse(id).success) throw new HttpError(404, 'Rapport introuvable.');
    const { data: check, error } = await client.from('verifications')
      .select('id,user_id,platform,content_text,accepted_caption,ai_score,ai_risk_level,status,created_at,completed_at,hash_sha256,prompt_version,ai_explanation')
      .eq('id', id).eq('user_id', user.id).single();
    if (error || !check) throw new HttpError(404, 'Rapport introuvable.');
    const details = check.ai_explanation && typeof check.ai_explanation === 'object'
      ? check.ai_explanation as { violations?: unknown } : {};
    const parsed = findingsSchema.safeParse(details.violations);
    const bytes = await buildArchivePdf({
      id: check.id,
      platform: check.platform,
      originalCaption: check.content_text,
      acceptedCaption: check.accepted_caption,
      score: check.ai_score,
      riskLevel: check.ai_risk_level,
      status: check.status,
      createdAt: check.created_at,
      completedAt: check.completed_at,
      sha256: check.hash_sha256,
      promptVersion: check.prompt_version,
      violations: parsed.success ? parsed.data : [],
    });
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="mentioncheck-rapport-' + id + '.pdf"',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    const { status, message } = publicError(error);
    if (status >= 500) logServerError('archive_pdf_failure', error, { status });
    return Response.json({ error: message }, { status,
      headers: { 'Cache-Control': 'no-store' } });
  }
}
