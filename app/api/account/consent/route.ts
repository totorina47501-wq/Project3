// Choix explicite et réversible d'usage des textes pour entraînement.
// Cette case n'autorise jamais OpenAI à utiliser des contenus automatiquement.
import { z } from 'zod';
import { requireUser, publicError, HttpError } from '@/lib/security/auth';

export const runtime = 'nodejs';
const schema = z.object({ aiTrainingOptIn: z.boolean() }).strict();
export async function POST(request: Request) {
  try {
    const { user, client } = await requireUser();
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin)
      throw new HttpError(403, 'Origine de la requête interdite.');
    let body: unknown;
    try { body = await request.json(); }
    catch { throw new HttpError(400, 'JSON invalide.'); }
    const input = schema.safeParse(body);
    if (!input.success) throw new HttpError(422, 'Consentement invalide.');
    // Les droits UPDATE sont limités à cette colonne dans la RLS Supabase.
    const { data, error } = await client.from('users')
      .update({ ai_training_opt_in: input.data.aiTrainingOptIn })
      .eq('id', user.id).select('ai_training_opt_in').single();
    if (error || !data) throw new Error('Enregistrement du consentement indisponible.');
    return Response.json({ aiTrainingOptIn: data.ai_training_opt_in }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const { status, message } = publicError(error);
    return Response.json({ error: message }, { status,
      headers: { 'Cache-Control': 'no-store' } });
  }
}
