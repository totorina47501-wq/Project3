// Route de compatibilité images : réutilise les validations, quotas et
// enregistrements de /api/media/prepare au lieu de délivrer des URL libres.
import { POST as prepareMedia } from '@/app/api/media/prepare/route';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  return prepareMedia(request);
}
