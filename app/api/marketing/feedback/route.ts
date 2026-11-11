import { isSameOrigin } from '@/lib/security/origin';

// Le stockage durable/effacement RGPD n'étant pas certifiés, toute collecte
// est fermée côté serveur, y compris en cas d'appel HTTP direct sans interface.
export const runtime = 'nodejs';

function blocked(): Response {
  return Response.json({ error: 'La collecte des retours est temporairement indisponible.' }, {
    status: 503,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

function forbidden(): Response {
  return Response.json({ error: 'Origine de la requête interdite.' }, {
    status: 403,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return forbidden();
  return blocked();
}

export async function DELETE(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return forbidden();
  return blocked();
}
