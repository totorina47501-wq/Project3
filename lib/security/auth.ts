// Chemin : lib/security/auth.ts
import { createServerSupabase } from '@/lib/supabase/server';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function requireUser() {
  const client = await createServerSupabase();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw new HttpError(401, 'Connecte-toi pour continuer.');
  }
  return { user: data.user, client };
}

export function publicError(error: unknown) {
  if (error instanceof HttpError) {
    return { status: error.status, message: error.message };
  }
  // Ne pas renvoyer les messages des SDK externes aux utilisateurs.
  return { status: 503, message: 'Le service est momentanément indisponible.' };
}
