import type { APIRequestContext, BrowserContext } from '@playwright/test';
export type LocalActor = { id: string; email: string; session: Record<string, unknown> };
export type Scenario = { actors: Record<'owner'|'member'|'outsider',LocalActor>; verificationIds: Record<'owner'|'member'|'outsider',string> };
export async function localScenario(request: APIRequestContext): Promise<Scenario> {
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '');
  if (!['127.0.0.1','localhost'].includes(url.hostname) || url.port !== '54329') throw new Error('Fixture SQL locale requise.');
  const response = await request.post(new URL('/__fixture__/scenarios',url).toString(), { headers: { 'x-mentioncheck-fixture':'local-only' }, data:{} });
  if (response.status()!==201) throw new Error('Création du scénario SQL local impossible.');
  return await response.json() as Scenario;
}
export async function useScenarioActor(context: BrowserContext, baseURL: string, actor: LocalActor) {
  const target=new URL(baseURL);
  if (!['localhost','127.0.0.1'].includes(target.hostname)) throw new Error('Navigateur local requis.');
  await context.clearCookies();
  await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(actor.session)).toString('base64url'),url:baseURL,sameSite:'Lax'}]);
}
