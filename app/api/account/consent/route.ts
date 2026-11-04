import { readPrivacyJson } from '@/lib/privacy/request';
import { isSameOrigin } from '@/lib/security/origin';
// Choix explicite et réversible d'usage des textes pour entraînement.
// Cette case n'autorise jamais OpenAI à utiliser des contenus automatiquement.
import { z } from 'zod';
import { requireUser, publicError, HttpError } from '@/lib/security/auth';

export const runtime = 'nodejs';
const schema = z.object({ aiTrainingOptIn: z.boolean() }).strict();
export async function POST(request: Request) {
  try {
    const { client } = await requireUser();
    if (!isSameOrigin(request))
      throw new HttpError(403, 'Origine de la requête interdite.');
    const body = await readPrivacyJson(request);
    const input = schema.safeParse(body);
    if (!input.success) throw new HttpError(422, 'Consentement invalide.');
    // La RPC manque tant que la migration de retrait atomique n'est pas appliquée : échec fermé.
    const { data, error } = await client.rpc('set_training_consent', {
      p_opt_in: input.data.aiTrainingOptIn,
    });
    if (error || typeof data !== 'boolean') throw new Error('Enregistrement du consentement indisponible.');
    return Response.json({ aiTrainingOptIn: data }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    const { status, message } = publicError(error);
    return Response.json({ error: message }, { status,
      headers: { 'Cache-Control': 'private, no-store' } });
  }
}
