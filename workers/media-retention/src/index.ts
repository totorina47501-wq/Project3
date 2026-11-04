// Worker Cloudflare indépendant à activer explicitement après validation.
// Ne connaît que l'URL interne et son token secret ; aucun accès OpenAI.
type Env = {
  MEDIA_RETENTION_ENABLED?: string;
  MEDIA_RETENTION_TOKEN?: string;
  MEDIA_RETENTION_URL?: string;
};
export default {
  async scheduled(_event: unknown, env: Env) {
    if (env.MEDIA_RETENTION_ENABLED !== 'true' ||
        !env.MEDIA_RETENTION_TOKEN || !env.MEDIA_RETENTION_URL) return;
    const target = new URL(env.MEDIA_RETENTION_URL);
    if (target.protocol !== 'https:' ||
        target.hostname !== 'mentioncheck.toto-rina47501.workers.dev' ||
        target.pathname !== '/api/internal/media-retention') {
      throw new Error('Cible de rétention interdite.');
    }
    target.searchParams.set('execute','true');
    const response = await fetch(target.toString(),{
      method:'POST',headers:{authorization:'Bearer '+env.MEDIA_RETENTION_TOKEN},
    });
    if (!response.ok) throw new Error('Purge média incomplète : consulter les logs.');
  },
};
