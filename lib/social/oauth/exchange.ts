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
  tokenType: string;
  expiresAt: string;
};

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

function accountHandle(provider: SocialOAuthProvider, value: unknown): string {
  const raw = identityText(value).replace(/^@/, '').toLowerCase();
  const normalized = raw.replace(/[^a-z0-9._-]/g, '_').slice(0, 200);
  const handle = /^[a-z0-9]/.test(normalized) ? normalized : `${provider}_${normalized}`;
  if (!/^[a-z0-9][a-z0-9._-]{0,199}$/.test(handle)) {
    throw new Error('OAuth provider response unavailable.');
  }
  return handle;
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
  const text = await response.text();
  if (text.length > MAX_RESPONSE_LENGTH) {
    throw new Error('OAuth provider response unavailable.');
  }
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
    return accountHandle(provider, token.username ?? token.user_id);
  }

  if (provider === 'tiktok') {
    return accountHandle(provider, token.open_id);
  }

  if (provider === 'youtube') {
    const profile = await requestJson(
      fetcher,
      'https://youtube.googleapis.com/youtube/v3/channels?part=id%2Csnippet&mine=true',
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
  const token = await tokenResponse(
    input.provider,
    input.config,
    input.redirectUri,
    input.authorizationCode,
    input.codeVerifier,
    fetcher,
  );
  const accessToken = requiredText(token.access_token);
  const expiresIn = Number(token.expires_in);
  if (!Number.isSafeInteger(expiresIn) || expiresIn < 60 || expiresIn > 31_536_000) {
    throw new Error('OAuth provider response unavailable.');
  }
  const expiresAt = new Date(
    (input.now ?? new Date()).getTime() + expiresIn * 1000,
  ).toISOString();
  const tokenType =
    typeof token.token_type === 'string' && token.token_type.length <= 40
      ? token.token_type
      : 'Bearer';
  const handle = await accountHandleFor(input.provider, token, accessToken, fetcher);
  const tokenBundle: OAuthTokenBundle = { accessToken, tokenType, expiresAt };
  return {
    handle,
    expiresAt,
    tokenSecret: JSON.stringify(tokenBundle),
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
      tokenType: requiredText(value?.tokenType, 40),
      expiresAt: requiredText(value?.expiresAt, 64),
    };
  } catch {
    throw new Error('Stored OAuth credential unavailable.');
  }
  if (Date.parse(bundle.expiresAt) <= (input.now ?? new Date()).getTime()) return;

  const body =
    input.provider === 'tiktok'
      ? formBody({
          client_key: input.config.clientId,
          client_secret: input.config.clientSecret,
          token: bundle.accessToken,
          token_type_hint: 'access_token',
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
}
