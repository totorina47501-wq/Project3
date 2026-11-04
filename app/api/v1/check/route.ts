import { readPrivacyJson } from '@/lib/privacy/request';
import { parseApiKey } from '@/lib/studio/secrets';
import { studioCheckSchema } from '@/lib/studio/schemas';
import { studioApiRpc } from '@/lib/studio/server';
import { studioResponse, studioFailure } from '@/lib/studio/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    // Refus de syntaxe avant toute lecture du corps ; la validité, les scopes
    // et le plan restent vérifiés transactionnellement en base ensuite.
    if (!parseApiKey(request.headers.get('authorization'))) return studioResponse({ error: 'Clé API Studio requise (Bearer).' }, 401);
    const input = studioCheckSchema.safeParse(await readPrivacyJson(request, 65536));
    if (!input.success) return studioResponse({ error: 'Texte ou plateforme invalide.' }, 400);
    return studioResponse(await studioApiRpc(request, 'save_check', input.data), 201);
  } catch (error) { return studioFailure(error); }
}
