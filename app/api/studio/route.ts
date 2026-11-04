import { readPrivacyJson } from '@/lib/privacy/request';
import { requireUser } from '@/lib/security/auth';
import { isSameOrigin } from '@/lib/security/origin';
import { studioActionSchema, workspaceIdSchema } from '@/lib/studio/schemas';
import { performStudioAction, studioOverview, studioRpc } from '@/lib/studio/server';
import { studioResponse, studioFailure } from '@/lib/studio/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { user } = await requireUser();
    const workspace = new URL(request.url).searchParams.get('workspaceId');
    if (workspace === null) return studioResponse(await studioRpc(user.id, null, 'list_workspaces'));
    if (!workspaceIdSchema.safeParse(workspace).success) return studioResponse({ error: 'Espace invalide.' }, 400);
    return studioResponse(await studioOverview(user.id, workspace));
  } catch (error) { return studioFailure(error); }
}
export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return studioResponse({ error: 'Origine interdite.' }, 403);
    const { user } = await requireUser();
    const input = studioActionSchema.safeParse(await readPrivacyJson(request, 65536));
    if (!input.success) return studioResponse({ error: 'Données Studio invalides.' }, 400);
    return studioResponse(await performStudioAction(user.id, input.data));
  } catch (error) { return studioFailure(error); }
}
