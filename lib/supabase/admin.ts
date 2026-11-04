// Chemin : lib/supabase/admin.ts
import 'server-only';
import { createClient } from '@supabase/supabase-js';

// Uniquement côté serveur : la clé privilégiée ne doit jamais être embarquée
// dans le client navigateur ni envoyée dans une réponse HTTP.
export function createAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('Service Supabase non configuré.');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
