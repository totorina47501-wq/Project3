// Chemin : lib/supabase/browser.ts
'use client';

import { createBrowserClient } from '@supabase/ssr';

export function createBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Connexion Supabase indisponible : configuration manquante.');
  }
  return createBrowserClient(url, key);
}
