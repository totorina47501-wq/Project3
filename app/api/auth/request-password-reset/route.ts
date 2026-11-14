import { z } from 'zod';
import { isSameOrigin } from '@/lib/security/origin';
import { createServerSupabase } from '@/lib/supabase/server';
import { requireAuthAttemptLimit } from '@/lib/security/auth-attempt-limit';
import { categorizeAuthError } from '@/lib/security/auth-diagnostics';
import { publicError } from '@/lib/security/auth';
import { logServerError } from '@/lib/security/logging';

const bodySchema = z.object({ email: z.string().email().max(320) }).strict();
const noStore = { 'Cache-Control': 'no-store' };
const genericMessage = 'Si un compte existe à cette adresse, un email de réinitialisation sera envoyé. Vérifie également les spams.';

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return Response.json({ error: 'Origine interdite.' }, { status: 403, headers: noStore });
    }
    await requireAuthAttemptLimit(request);
    const body = bodySchema.safeParse(await request.json());
    if (!body.success) {
      return Response.json({ error: 'Saisis une adresse email valide.' },
        { status: 400, headers: noStore });
    }
    const callbackUrl = new URL('/api/auth/recovery', request.url).toString();
    const client = await createServerSupabase();
    // Le SDK Supabase gère le lien Recovery et son vérificateur PKCE via la session SSR.
    const { error } = await client.auth.resetPasswordForEmail(body.data.email, {
      redirectTo: callbackUrl,
    });
    if (error) {
      const category = categorizeAuthError(error);
      if (category === 'rate_limited') {
        return Response.json({ error: 'Trop de demandes. Réessaie plus tard.' },
          { status: 429, headers: noStore });
      }
      // Ne pas permettre d'énumérer les comptes par les codes d'erreur fournisseur.
      if (error.status === 400 || error.status === 404 || error.status === 422) {
        return Response.json({ ok: true, message: genericMessage }, { headers: noStore });
      }
      logServerError('auth_password_reset_request_failure', error, {
        category,
        providerStatus: typeof error.status === 'number' ? error.status : null,
      });
      return Response.json({ error: 'Envoi momentanément indisponible. Réessaie plus tard.' },
        { status: 503, headers: noStore });
    }
    return Response.json({ ok: true, message: genericMessage }, { headers: noStore });
  } catch (error) {
    const { status, message } = publicError(error);
    return Response.json({ error: message }, { status, headers: noStore });
  }
}
