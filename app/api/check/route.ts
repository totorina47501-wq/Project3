// Chemin : app/api/check/route.ts
import { checkInputSchema } from '@/lib/ai/schemas';
import { runCheck, validateMedia } from '@/lib/ai/mentioncheck-engine';
import { createEventStream } from '@/lib/sse';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { requireUser, HttpError, publicError } from '@/lib/security/auth';
import { consumeQuota, refundQuota } from '@/lib/security/quota';
import { checkRateLimit } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { user } = await requireUser();
    if (!process.env.OPENAI_API_KEY) throw new HttpError(503, 'IA non configurée.');
    const payload = checkInputSchema.safeParse(await request.json());
    if (!payload.success) {
      return Response.json({ error: 'Publication ou plateforme invalide.' }, { status: 400 });
    }
    if (payload.data.mediaType !== 'none' && payload.data.mediaType !== 'image') {
      throw new HttpError(422, 'Les vidéos et carrousels seront disponibles prochainement.');
    }
    if (payload.data.mediaUrl) {
      await validateMedia(user.id, payload.data.mediaUrl);
    }
    const admin = createAdminSupabase();
    const { data: profile, error } = await admin.from('users')
      .select('plan').eq('id', user.id).single();
    if (error || !profile) throw new HttpError(503, 'Profil Supabase indisponible.');
    await checkRateLimit(user.id, profile.plan);
    await consumeQuota(user.id, 'check');

    const stream = createEventStream(async (emit) => {
      try {
        const result = await runCheck({ ...payload.data, userId: user.id }, emit);
        emit('done', result);
      } catch {
        await refundQuota(user.id, 'check');
        emit('error', { message: 'La vérification a échoué. Le quota a été restitué.' });
      }
    });
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: 'Requête JSON incorrecte.' }, { status: 400 });
    }
    const { status, message } = publicError(error);
    return Response.json({ error: message }, { status });
  }
}
