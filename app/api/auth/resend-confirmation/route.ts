// Reprise de confirmation sans révéler si une adresse existe.
import { z } from 'zod';
import { isSameOrigin } from '@/lib/security/origin';
import { createServerSupabase } from '@/lib/supabase/server';
import { requireAuthAttemptLimit } from '@/lib/security/auth-attempt-limit';
import { categorizeAuthError } from '@/lib/security/auth-diagnostics';
import { logServerError } from '@/lib/security/logging';
import { publicError } from '@/lib/security/auth';

const schema = z.object({ email: z.string().email().max(320) }).strict();
const noStore = { 'Cache-Control': 'no-store' };

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return Response.json({ error: 'Origine interdite.' }, { status: 403, headers: noStore });
    }
    await requireAuthAttemptLimit(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: 'Saisis une adresse email valide.' }, { status: 400, headers: noStore });
    }
    const client = await createServerSupabase();
    // Ne pas employer de privilège admin pour contourner la confirmation.
    // Le Site URL Supabase doit pointer vers l'origine de production.
    const { error } = await client.auth.resend({ type: 'signup', email: parsed.data.email });
    if (error) {
      const category = categorizeAuthError(error);
      if (category === 'rate_limited') {
        return Response.json({ error: 'Trop de demandes. Réessaie plus tard.' },
          { status: 429, headers: noStore });
      }
      logServerError('auth_resend_confirmation_failure', error, {
        category,
        providerStatus: typeof error.status === 'number' ? error.status : null,
      });
      return Response.json({ error: 'Envoi momentanément indisponible. Réessaie plus tard.' },
        { status: 503, headers: noStore });
    }
    // Réponse volontairement identique pour un compte inexistant et non confirmé.
    return Response.json({
      ok: true,
      message: 'Si cette adresse attend une confirmation, un email a été envoyé. Ouvre uniquement le dernier lien reçu et vérifie aussi les spams.',
    }, { headers: noStore });
  } catch (error) {
    const { status, message } = publicError(error);
    return Response.json({ error: message }, { status, headers: noStore });
  }
}
