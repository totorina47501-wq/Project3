/**
 * Client serveur pour l'API Studio MentionCheck (sans IA).
 * Ne jamais embarquer une clé Studio dans un bundle navigateur.
 */
export type Platform = 'instagram' | 'tiktok' | 'youtube' | 'linkedin';
export type CheckInput = { caption: string; platform: Platform };
export type Verification = Record<string, unknown>;
export type VerificationList = { items: Verification[]; limit: number };
export type CheckResult = { verification: Verification };

export class MentionCheckApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'MentionCheckApiError';
  }
}

export type MentionCheckClientOptions = {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export class MentionCheckClient {
  private readonly url: string;
  private readonly key: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: MentionCheckClientOptions) {
    if (!/^mc_studio_[a-f0-9]{64}$/.test(options.apiKey)) {
      throw new Error('Format de clé Studio invalide');
    }
    const base = new URL(options.baseUrl ?? 'https://mentioncheck.toto-rina47501.workers.dev');
    if (base.protocol !== 'https:' && base.hostname !== 'localhost' && base.hostname !== '127.0.0.1') {
      throw new Error('Une URL HTTPS est requise');
    }
    if (base.username || base.password || base.search || base.hash) throw new Error('URL de base invalide');
    this.url = base.toString().replace(/\/$/, '');
    this.key = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 15000;
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) throw new Error('Timeout invalide');
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async request<T>(path: string, method: 'GET' | 'POST', payload?: CheckInput, signal?: AbortSignal): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    try {
      if (signal?.aborted) controller.abort();
      const response = await this.fetchImpl(this.url + path, {
        method,
        headers: {
          Authorization: 'Bearer ' + this.key,
          Accept: 'application/json',
          ...(payload ? { 'Content-Type': 'application/json' } : {}),
        },
        body: payload ? JSON.stringify(payload) : undefined,
        signal: controller.signal,
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
          ? body.error : 'Erreur API MentionCheck';
        throw new MentionCheckApiError(response.status, message);
      }
      return body as T;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }
  }

  check(input: CheckInput, signal?: AbortSignal): Promise<CheckResult> {
    return this.request('/api/v1/check', 'POST', input, signal);
  }

  verifications(signal?: AbortSignal): Promise<VerificationList> {
    return this.request('/api/v1/verifications', 'GET', undefined, signal);
  }
}
