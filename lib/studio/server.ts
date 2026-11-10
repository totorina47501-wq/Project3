import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { HttpError } from '@/lib/security/auth';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { createSecret, hashSecret, parseApiKey } from './secrets';
import { evaluateStudioText, buildBrandSafetyReport } from './report';
import type { StudioAction } from './schemas';
import type { Platform } from '@/lib/ai/schemas';

type RpcError = { code?: string; message?: string };
export function throwStudioError(error: RpcError): never {
  if (error.code === 'P0001') throw new HttpError(429, 'Quota API Studio mensuel atteint.');
  if (error.code === '42501') throw new HttpError(403, 'Accès Studio refusé, jeton expiré ou permission insuffisante.');
  if (error.code === '23505') throw new HttpError(409, 'Cet espace, ce membre ou cette invitation existe déjà.');
  if (error.code === '23514') throw new HttpError(409, 'Limite Studio atteinte ou données invalides. Cinq sièges maximum, invitations comprises.');
  if (error.code === '22023' || error.code === '22P02' || error.code === '23502') throw new HttpError(400, 'Données Studio invalides.');
  throw new HttpError(503, 'Studio indisponible.');
}

/** L'acteur provient exclusivement de requireUser, jamais du JSON client. */
export async function studioRpc(actor: string, workspace: string | null, action: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await createAdminSupabase().rpc('studio_execute', {
    p_actor: actor, p_workspace: workspace, p_action: action, p_payload: payload,
  });
  if (error) throwStudioError(error);
  return data;
}

export async function performStudioAction(actor: string, input: StudioAction) {
  const workspace = 'workspaceId' in input ? input.workspaceId : null;
  switch (input.action) {
    case 'create_workspace': return studioRpc(actor, null, input.action, { name: input.name });
    case 'accept_invitation': return studioRpc(actor, null, input.action, { token_hash: await hashSecret(input.token) });
    case 'invite': {
      const secret = await createSecret('invitation');
      const result = await studioRpc(actor, workspace, input.action, { email: input.email.toLowerCase(), role: input.role, token_hash: secret.hash });
      return { ...result, token: secret.secret };
    }
    case 'create_key': {
      const secret = await createSecret('key');
      const result = await studioRpc(actor, workspace, input.action, {
        name: input.name, scopes: [...new Set(input.scopes)], token_hash: secret.hash, prefix: secret.prefix,
      });
      return { ...result, secret: secret.secret };
    }
    case 'revoke_key': case 'revoke_invitation': return studioRpc(actor, workspace, input.action, { id: input.id });
    case 'remove_member': return studioRpc(actor, workspace, input.action, { user_id: input.userId });
    case 'set_role': return studioRpc(actor, workspace, input.action, { user_id: input.userId, role: input.role });
    case 'check': {
      // Le moteur règles est réutilisé ; on n'appelle pas le moteur personnel qui
      // écrirait implicitement dans l'historique privé du créateur.
      await checkRateLimit(`studio:${actor}`, 'studio');
      return studioRpc(actor, workspace, 'save_check', {
        caption: input.caption, platform: input.platform, result: evaluateStudioText(input),
      });
    }
  }
}

export async function studioOverview(actor: string, workspace: string) {
  const overview = await studioRpc(actor, workspace, 'overview');
  const checks = await studioRpc(actor, workspace, 'checks');
  return { ...overview, checks: checks.items, report: buildBrandSafetyReport(workspace, checks.items) };
}

export async function studioApiRpc(request: Request, action: 'checks' | 'save_check', input?: { caption: string; platform: Platform }) {
  const secret = parseApiKey(request.headers.get('authorization'));
  if (!secret) throw new HttpError(401, 'Clé API Studio requise (Bearer).');
  const hash = await hashSecret(secret);
  await checkRateLimit(`studio-api:${hash}`, 'studio');
  const payload = input ? { ...input, result: evaluateStudioText(input) } : {};
  const { data, error } = await createAdminSupabase().rpc('studio_execute_api', {
    p_hash: hash, p_action: action, p_payload: payload,
  });
  if (error) throwStudioError(error);
  return data;
}
