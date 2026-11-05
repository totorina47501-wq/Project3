// Binding interne seulement : aucun endpoint public pour démarrer un conteneur.
import { getCloudflareContext } from '@opennextjs/cloudflare';
type RunnerBinding = { getByName(name: string): { fetch(request: Request): Promise<Response> } };
export async function notifyCloudflareMediaRunner(): Promise<boolean> {
  if (process.env.MEDIA_CLOUDFLARE_RUNNER_ENABLED !== 'true' || process.env.MEDIA_RUNNER_PAUSED === 'true') return false;
  try {
    const { env } = await getCloudflareContext();
    const binding = (env as unknown as { MEDIA_RUNNER?: RunnerBinding }).MEDIA_RUNNER;
    if (!binding) return false;
    const response = await binding.getByName('mentioncheck-media-singleton').fetch(
      new Request('https://media.internal/wake', { method: 'POST' }));
    return response.status === 202;
  } catch { console.warn('[mentioncheck][media_wake_failed]'); return false; }
}
export async function readCloudflareMediaStatus(): Promise<unknown> {
  if (process.env.MEDIA_CLOUDFLARE_RUNNER_ENABLED !== 'true') return { configured: false };
  try {
    const { env } = await getCloudflareContext();
    const binding = (env as unknown as { MEDIA_RUNNER?: RunnerBinding }).MEDIA_RUNNER;
    if (!binding) return { configured: false };
    const response = await binding.getByName('mentioncheck-media-singleton').fetch(new Request('https://media.internal/status'));
    return response.ok ? await response.json() : { configured: false };
  } catch { return { configured: false }; }
}
