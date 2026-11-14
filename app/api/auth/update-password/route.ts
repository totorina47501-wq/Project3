import { z } from 'zod';
import { isSameOrigin } from '@/lib/security/origin';
import { requireUser, publicError } from '@/lib/security/auth';
import { requireAuthAttemptLimit } from '@/lib/security/auth-attempt-limit';
import { acceptableRegistrationPassword } from '@/lib/security/password-policy';
import { categorizeAuthError } from '@/lib/security/auth-diagnostics';
import { logServerError } from '@/lib/security/logging';

const bodySchema = z.object({
  password: z.string().min(12).max(200).refine(acceptableRegistrationPassword),
}).strict();
const noStore = { 'Cache-Control': 'no-store' };

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return Response.json({ error: 'Origine interdite.' }, { status: 403, headers: noStore });
    }
    await requireAuthAttemptLimit(request);
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({
        error: 'Le nouveau mot de passe doit comporter 12 caractères minimum, une minuscule, une majuscule, un chiffre et un symbole.',
      }, { status: 400, headers: noStore });
    }
    // La session doit provenir du lien Recovery validé par Supabase. Aucun mode admin.
    const { client } = await requireUser();
    const { error } = await client.auth.updateUser({ password: parsed.data.password });
    if (error) {
      const category = categorizeAuthError(error);
      if (category === 'rate_limited') {
        return Response.json({ error: 'Trop de tentatives. Réessaie plus tard.' },
          { status: 429, headers: noStore });
      }
      if (error.status === 400 || error.status === 422) {
        return Response.json({
          error: 'Mot de passe refusé par le service. Choisis un mot de passe plus fort et unique.',
        }, { status: 400, headers: noStore });
      }
      logServerError('auth_update_password_failure', error, {
        category,
        providerStatus: typeof error.status === 'number' ? error.status : null,
      });
      return Response.json({ error: 'Mise à jour momentanément indisponible.' },
        { status: 503, headers: noStore });
    }
    // Révoque uniquement la session ouverte par ce navigateur après la récupération.
    const { error: signOutError } = await client.auth.signOut({ scope: 'local' });
    if (signOutError) {
      logServerError('auth_reset_signout_failure', signOutError, { category: 'local_signout' });
    }
    return Response.json({ ok: true }, { headers: noStore });
  } catch (error) {
    const { status, message } = publicError(error);
    return Response.json({
      error: status === 401 ? 'Le lien de récupération a expiré. Demande un nouveau lien.' : message,
    }, { status, headers: noStore });
  }
}
