// Orchestration Durable Object : aucune clé n'est renvoyée au navigateur.
type Store = {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  getAlarm(): Promise<number | null>;
  setAlarm(timestamp: number): Promise<void>;
  deleteAlarm(): Promise<void>;
};
type ContainerRuntime = {
  running: boolean;
  start(options: { enableInternet: boolean; env: Record<string, string> }): void;
  destroy(): Promise<void>;
  setInactivityTimeout(milliseconds: number): Promise<void>;
};
type Environment = Record<string, string | undefined>;
type Context = { storage: Store; container?: ContainerRuntime };
type PendingJob = { status?: unknown; available_at?: unknown; lease_until?: unknown };
const MAX_RUN_MS = 270_000;
export class CloudflareMediaController {
  constructor(private readonly ctx: Context, private readonly env: Environment,
    private readonly fetcher: typeof fetch = fetch, private readonly now: () => number = Date.now) {}
  private url() { return this.env.SUPABASE_URL ?? this.env.NEXT_PUBLIC_SUPABASE_URL ?? ''; }
  private ready() {
    return this.env.MEDIA_CLOUDFLARE_RUNNER_ENABLED === 'true' && this.env.MEDIA_RUNNER_PAUSED !== 'true'
      && Boolean(this.env.SUPABASE_SERVICE_KEY?.trim()) && Boolean(this.ctx.container)
      && /^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(this.url());
  }
  private response(body: unknown, status = 200) {
    return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
  }
  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === '/status' && request.method === 'GET') return this.response({
      revision: 'cloudflare-media-v4',
      failureStage: await this.ctx.storage.get<string>('failureStage') ?? null,
      failureType: await this.ctx.storage.get<string>('failureType') ?? null,
      failureCode: await this.ctx.storage.get<string>('failureCode') ?? null,
      httpStatus: await this.ctx.storage.get<number>('httpStatus') ?? null,
      configured: this.ready(), running: this.ctx.container?.running ?? false,
      phase: await this.ctx.storage.get<string>('phase') ?? 'idle',
      lastError: await this.ctx.storage.get<string>('lastError') ?? null,
    });
    if (path !== '/wake') return this.response({ error: 'Route interne inconnue.' }, 404);
    if (request.method !== 'POST') return this.response({ error: 'Méthode interdite.' }, 405);
    if (!this.ready()) return this.response({ error: 'Runner Cloudflare indisponible.' }, 503);
    await this.ctx.storage.put('failures', 0);
    const alarm = await this.ctx.storage.getAlarm();
    if (alarm === null || alarm > this.now() + 1000) await this.ctx.storage.setAlarm(this.now() + 1000);
    return this.response({ scheduled: true }, 202);
  }
  async alarm(): Promise<void> {
    const { storage, container } = this.ctx;
    let stage = 'initialization';
    try {
      if (!this.ready() || !container) {
        if (container?.running) await container.destroy();
        await storage.deleteAlarm(); return;
      }
      stage = 'monitor';
      const startedAt = await storage.get<number>('startedAt');
      if (startedAt !== undefined && container.running) {
        if (this.now() - startedAt >= MAX_RUN_MS) {
          await container.destroy();
          await storage.put('lastError', 'RUN_TIMEOUT');
          await storage.put('phase', 'stopped');
        }
        await storage.setAlarm(this.now() + 15_000); return;
      }
      // Laisser le temps de démarrer sans lancer une deuxième instance.
      if (startedAt !== undefined && this.now() - startedAt < 30_000) {
        await storage.setAlarm(this.now() + 15_000); return;
      }
      if (container.running) {
        // État retrouvé après éviction de l'objet : borne de sûreté.
        await storage.put('startedAt', this.now());
        await container.setInactivityTimeout(MAX_RUN_MS);
        await storage.setAlarm(this.now() + 15_000); return;
      }
      stage = 'poll';
      const endpoint = new URL('/rest/v1/media_processing_jobs', this.url());
      endpoint.searchParams.set('select', 'status,available_at,lease_until');
      endpoint.searchParams.set('status', 'in.(queued,processing)');
      endpoint.searchParams.set('order', 'available_at.asc');
      endpoint.searchParams.set('limit', '100');
      const key = this.env.SUPABASE_SERVICE_KEY!;
      const response = await this.fetcher.call(globalThis, endpoint, { headers: { apikey: key, Authorization: `Bearer ${key}` },
        redirect: 'manual', signal: AbortSignal.timeout(10_000), cache: 'no-store' });
      await storage.put('httpStatus', response.status);
      if (!response.ok) throw new Error('File indisponible.');
      stage = 'decode';
      const jobs: unknown = await response.json();
      if (!Array.isArray(jobs)) throw new Error('File invalide.');
      let available = false, next = Infinity;
      for (const value of jobs) {
        if (!value || typeof value !== 'object') throw new Error('Job invalide.');
        const job = value as PendingJob;
        const raw = job.status === 'processing' ? job.lease_until : job.available_at;
        if (typeof raw !== 'string' || !Number.isFinite(Date.parse(raw))) throw new Error('Échéance invalide.');
        const time = Date.parse(raw);
        if (time <= this.now()) available = true;
        else next = Math.min(next, time);
      }
      await storage.put('failures', 0);
      if (!available) {
        await storage.put('phase', Number.isFinite(next) ? 'waiting' : 'idle');
        if (Number.isFinite(next)) await storage.setAlarm(Math.max(this.now() + 1000, next + 1000));
        else await storage.deleteAlarm();
        return;
      }
      stage = 'budget';
      const hour = Math.floor(this.now() / 3_600_000);
      const saved = await storage.get<{ hour: number; count: number }>('budget');
      const count = saved?.hour === hour ? saved.count : 0;
      if (count >= 60) {
        await storage.put('phase', 'limited');
        await storage.setAlarm((hour + 1) * 3_600_000 + 1000); return;
      }
      // Sauver le watchdog avant tout démarrage potentiellement facturé.
      await storage.put('budget', { hour, count: count + 1 });
      await storage.put('startedAt', this.now());
      await storage.put('phase', 'running');
      await storage.setAlarm(this.now() + 15_000);
      stage = 'start';
      container.start({ enableInternet: true,
        env: { MEDIA_RUNNER_ENABLED: 'true', MEDIA_RUNNER_ONCE: 'true', MEDIA_RUNNER_WORK_ROOT: '/work',
          SUPABASE_URL: this.url(), SUPABASE_SERVICE_KEY: key, OPENAI_PAUSED: 'true', BILLING_ENABLED: 'false' } });
      stage = 'timeout';
      await container.setInactivityTimeout(MAX_RUN_MS);
    } catch (error) {
      await storage.put('failureStage', stage);
      const name = error instanceof Error ? error.name : '';
      const message = error instanceof Error ? error.message : '';
      const categories: Array<[RegExp,string]> = [
        [/illegal invocation/i,'NATIVE_CONTEXT'],[/billing|paid plan|credit/i,'PLAN_ACCESS'],
        [/not supported|unsupported|not implemented/i,'RUNTIME_UNSUPPORTED'],
        [/image.*(not found|missing|pull)/i,'IMAGE_UNAVAILABLE'],
        [/already running|needs to be running|not running/i,'CONTAINER_STATE'],
        [/not configured|not bound|no container|not found/i,'CONTAINER_NOT_READY'],
        [/timeout|aborted/i,'TIMEOUT'],[/network|connection|fetch failed/i,'NETWORK'],
      ];
      await storage.put('failureCode', categories.find(([pattern]) => pattern.test(message))?.[1] ?? 'UNKNOWN');
      await storage.put('failureType', ['Error','TypeError','SyntaxError','RangeError'].includes(name) ? name : 'Error');
      const count = (await storage.get<number>('failures') ?? 0) + 1;
      await storage.put('failures', count); await storage.put('lastError', 'RUNNER_UNAVAILABLE');
      await storage.put('phase', 'error');
      if (count < 5) await storage.setAlarm(this.now() + 30_000);
      else await storage.deleteAlarm();
    }
  }
}
