// Chemin : middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return response;
  }
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(entries) {
        entries.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        entries.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  // Ces réponses peuvent porter des cookies de session : jamais de cache partagé.
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.append('Vary', 'Cookie');
  // Ne jamais décider des droits avec getSession() seul.
  try { await supabase.auth.getUser(); } catch {
    // La route reste responsable de requireUser(), qui refuse une session non vérifiée.
    // Ne pas exposer ni journaliser l'erreur fournisseur.
  }
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Vary', 'Cookie');
  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/register', '/api/:path*'],
};
