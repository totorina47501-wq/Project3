import { studioApiRpc } from '@/lib/studio/server';
import { studioResponse, studioFailure } from '@/lib/studio/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try { return studioResponse(await studioApiRpc(request, 'checks')); }
  catch (error) { return studioFailure(error); }
}
