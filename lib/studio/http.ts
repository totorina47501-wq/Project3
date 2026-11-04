import { publicError } from '@/lib/security/auth';
export function studioResponse(data: unknown, status = 200) {
  return Response.json(data, { status, headers: {
    'Cache-Control': 'private, no-store', 'Pragma': 'no-cache',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  } });
}
export function studioFailure(error: unknown) {
  if (error instanceof SyntaxError) return studioResponse({ error: 'Requête JSON incorrecte.' }, 400);
  const result = publicError(error);
  return studioResponse({ error: result.message }, result.status);
}
