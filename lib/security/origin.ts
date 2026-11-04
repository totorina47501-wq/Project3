// Validation pure de l'origine des écritures utilisant les cookies Supabase.
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}
