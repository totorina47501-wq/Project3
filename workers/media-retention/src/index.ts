// Worker planifié indépendant : rétention et indexation Mia opt-in.
// Les secrets restent dans les variables Cloudflare de ce Worker.
type Env = {
  MEDIA_RETENTION_ENABLED?: string;
  MEDIA_RETENTION_TOKEN?: string;
  MEDIA_RETENTION_URL?: string;
  MIA_DAILY_INDEX_ENABLED?: string;
  MIA_INDEX_TOKEN?: string;
};
const HOST = 'mentioncheck.toto-rina47501.workers.dev';
async function callInternal(path: string, token: string, execute = true) {
  if (token.length < 32) throw new Error('Jeton opérateur invalide.');
  const url = new URL('https://' + HOST + path);
  if (execute) url.searchParams.set('execute', 'true');
  const response = await fetch(url.toString(), {
    method: 'POST', headers: { authorization: 'Bearer ' + token },
  });
  if (!response.ok) throw new Error('Opération planifiée indisponible : ' + path);
}
const worker = {
  async scheduled(_event: unknown, env: Env) {
    const jobs: Promise<void>[] = [];
    if (env.MEDIA_RETENTION_ENABLED === 'true') {
      if (!env.MEDIA_RETENTION_TOKEN || !env.MEDIA_RETENTION_URL)
        throw new Error('Rétention activée sans configuration.');
      const target = new URL(env.MEDIA_RETENTION_URL);
      if (target.protocol !== 'https:' || target.hostname !== HOST ||
          target.pathname !== '/api/internal/media-retention' ||
          target.username || target.password || target.port)
        throw new Error('Cible de rétention interdite.');
      jobs.push(callInternal('/api/internal/media-retention', env.MEDIA_RETENTION_TOKEN));
    }
    if (env.MIA_DAILY_INDEX_ENABLED === 'true') {
      if (!env.MIA_INDEX_TOKEN) throw new Error('Indexation Mia activée sans jeton.');
      jobs.push(callInternal('/api/internal/mia-index', env.MIA_INDEX_TOKEN));
    }
    const results = await Promise.allSettled(jobs);
    if (results.some(result => result.status === 'rejected'))
      throw new Error('Une opération planifiée a échoué : consulter les logs.');
  },
};
export default worker;
