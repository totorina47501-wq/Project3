import 'server-only';
import {
  socialOAuthProviders,
  type SocialOAuthProvider,
  type SocialOAuthRuntimeConfig,
} from './providers';

const TOKEN_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_LENGTH = 16_384;

type OAuthTokenBundle = {
  accessToken: string;
  expiresAt: string;
};

export class OAuthProviderStageError extends Error {
  constructor(
    public readonly stage: 'token' | 'channel',
    message: string,
  ) {
    super(message);
    this.name = 'OAuthProviderStageError';
  }
}

export type ExchangedSocialAccount = {
  handle: string;
  tokenSecret: string;
  expiresAt: string;
};

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function requiredText(value: unknown, maxLength = 4096): string {
  if (
    typeof value !== 'string' ||
    !value ||
    value.length > maxLength ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new Error('OAuth provider response unavailable.');
  }
  return value;
}

function identityText(value: unknown): string {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value);
  return requiredText(value, 200);
}

async function boundedResponseText(response: Response): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_RESPONSE_LENGTH) {
        await reader.cancel();
        throw new Error('OAuth provider response unavailable.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('OAuth provider response unavailable.');
  }
}

function accountHandle(provider: SocialOAuthProvider, value: unknown): string {
  const raw = identityText(value).replace(/^@/, '');
  if (!raw) throw new Error('OAuth provider response unavailable.');
  const casePreserved = raw.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
  const prefix = `${provider}_`;
  const stableHandle = /^[a-zA-Z0-9]/.test(casePreserved)
    ? casePreserved
    : `${prefix}${casePreserved.slice(0, 200 - prefix.length)}`;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/.test(stableHandle)) {
    throw new Error('OAuth provider response unavailable.');
  }
  return stableHandle;
}

async function requestJson(
  fetcher: typeof fetch,
  url: string,
  init: RequestInit,
): Promise<Record<string, unknown>> {
  const response = await fetcher(url, {
    ...init,
    cache: 'no-store',
    credentials: 'omit',
    redirect: 'error',
    signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error('OAuth provider request unavailable.');
  const text = await boundedResponseText(response);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('OAuth provider response unavailable.');
  }
  const result = object(parsed);
  if (!result) throw new Error('OAuth provider response unavailable.');
  return result;
}

function formBody(values: Record<string, string>): URLSearchParams {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) body.set(key, value);
  return body;
}

async function tokenResponse(
  provider: SocialOAuthProvider,
  config: SocialOAuthRuntimeConfig,
  redirectUri: string,
  code: string,
  codeVerifier: string | null,
  fetcher: typeof fetch,
): Promise<Record<string, unknown>> {
  const definition = socialOAuthProviders[provider];
  const body: Record<string, string> = {
    [definition.clientIdParameter]: config.clientId,
    client_secret: config.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  };
  if (provider === 'tiktok' && codeVerifier) body.code_verifier = codeVerifier;
  if (provider === 'youtube' && codeVerifier) body.code_verifier = codeVerifier;

  const response = await requestJson(fetcher, definition.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formBody(body),
  });
  if (provider === 'tiktok') {
    const data = object(response.data);
    if (!data) throw new Error('OAuth provider response unavailable.');
    if (response.error) throw new Error('OAuth provider request unavailable.');
    return data;
  }
  if (response.error || response.error_description) {
    throw new Error('OAuth provider request unavailable.');
  }
  return response;
}

async function accountHandleFor(
  provider: SocialOAuthProvider,
  token: Record<string, unknown>,
  accessToken: string,
  fetcher: typeof fetch,
): Promise<string> {
  if (provider === 'instagram') {
    return accountHandle(provider, token.user_id);
  }

  if (provider === 'tiktok') {
    return accountHandle(provider, token.open_id);
  }

  if (provider === 'youtube') {
    const profile = await requestJson(
      fetcher,
      'https://youtube.googleapis.com/youtube/v3/channels?part=id&mine=true',
      { headers: { Authorization: 'Bearer ' + accessToken } },
    );
    const items = profile.items;
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('OAuth provider response unavailable.');
    }
    const channel = object(items[0]);
    return accountHandle(provider, channel?.id);
  }

  const profile = await requestJson(fetcher, 'https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: 'Bearer ' + accessToken },
  });
  return accountHandle(provider, profile.sub);
}

export async function exchangeSocialOAuthCode(input: {
  provider: SocialOAuthProvider;
  config: SocialOAuthRuntimeConfig;
  redirectUri: string;
  authorizationCode: string;
  codeVerifier: string | null;
  fetcher?: typeof fetch;
  now?: Date;
}): Promise<ExchangedSocialAccount> {
  const fetcher = input.fetcher ?? fetch;
  let token: Record<string, unknown>;
  let accessToken: string;
  let expiresIn: number;
  try {
    token = await tokenResponse(
      input.provider,
      input.config,
      input.redirectUri,
      input.authorizationCode,
      input.codeVerifier,
      fetcher,
    );
    accessToken = requiredText(token.access_token);
    expiresIn =
      input.provider === 'instagram' && token.expires_in === undefined
        ? 3600
        : Number(token.expires_in);
    if (!Number.isSafeInteger(expiresIn) || expiresIn < 60 || expiresIn > 31_536_000) {
      throw new Error('OAuth provider response unavailable.');
    }
  } catch (error) {
    // Only expose a fixed error category, never provider payloads or credentials.
    const safeMessage =
      error instanceof Error &&
      /^OAuth provider (?:request|response) unavailable\.$/.test(error.message)
        ? error.message
        : 'OAuth provider response unavailable.';
    throw new OAuthProviderStageError('token', safeMessage);
  }
  const expiresAt = new Date(
    (input.now ?? new Date()).getTime() + expiresIn * 1000,
  ).toISOString();
  const tokenBundle: OAuthTokenBundle = { accessToken, expiresAt };
  const tokenSecret = JSON.stringify(tokenBundle);
  let handle: string;
  try {
    handle = await accountHandleFor(input.provider, token, accessToken, fetcher);
  } catch {
    try {
      await revokeSocialOAuthToken({
        provider: input.provider,
        config: input.config,
        tokenSecret,
        fetcher,
        ...(input.now ? { now: input.now } : {}),
      });
    } catch {}
    throw new OAuthProviderStageError('channel', 'OAuth provider response unavailable.');
  }
  return {
    handle,
    expiresAt,
    tokenSecret,
  };
}

export async function revokeSocialOAuthToken(input: {
  provider: SocialOAuthProvider;
  config: SocialOAuthRuntimeConfig;
  tokenSecret: string;
  fetcher?: typeof fetch;
  now?: Date;
}): Promise<void> {
  const definition = socialOAuthProviders[input.provider];
  if (!definition.revocationEndpoint) return;

  let bundle: OAuthTokenBundle;
  try {
    const parsed: unknown = JSON.parse(input.tokenSecret);
    const value = object(parsed);
    bundle = {
      accessToken: requiredText(value?.accessToken),
      expiresAt: requiredText(value?.expiresAt, 64),
    };
  } catch {
    throw new Error('Stored OAuth credential unavailable.');
  }
  const expiresAt = Date.parse(bundle.expiresAt);
  if (!Number.isFinite(expiresAt)) {
    throw new Error('Stored OAuth credential unavailable.');
  }
  if (expiresAt <= (input.now ?? new Date()).getTime()) return;

  const body =
    input.provider === 'tiktok'
      ? formBody({
          client_key: input.config.clientId,
          client_secret: input.config.clientSecret,
          token: bundle.accessToken,
        })
      : formBody({ token: bundle.accessToken });
  const response = await (input.fetcher ?? fetch)(definition.revocationEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
    credentials: 'omit',
    redirect: 'error',
    signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error('OAuth provider request unavailable.');
  const text = await boundedResponseText(response);
  if (text.trim()) {
    let responseBody: unknown;
    try {
      responseBody = JSON.parse(text);
    } catch {
      throw new Error('OAuth provider response unavailable.');
    }
    if (object(responseBody)?.error) {
      throw new Error('OAuth provider request unavailable.');
    }
  }
}
