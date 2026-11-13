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

export type GoogleTokenErrorReason = 'invalid_client' | 'invalid_grant' | 'redirect_uri_mismatch' | 'invalid_request';
export type OAuthProfileErrorReason = 'no_channel' | 'profile_unavailable' | 'no_pages' | 'permission_denied';
export type OAuthProviderErrorReason = GoogleTokenErrorReason | OAuthProfileErrorReason;

const FACEBOOK_GRAPH = 'https://graph.facebook.com/v25.0';
const FACEBOOK_PAGE_LIMIT = 20;

// Only classify known provider outcomes; never surface raw API response data.
class OAuthProfileError extends Error {
  constructor(public readonly reason: OAuthProfileErrorReason) {
    super('OAuth provider response unavailable.');
    this.name = 'OAuthProfileError';
  }
}

class GoogleTokenResponseError extends Error {
  constructor(public readonly reason?: GoogleTokenErrorReason) {
    super('OAuth provider request unavailable.');
  }
}

function safeGoogleTokenReason(value: unknown): GoogleTokenErrorReason | undefined {
  return value === 'invalid_client' || value === 'invalid_grant' ||
    value === 'redirect_uri_mismatch' || value === 'invalid_request'
    ? value : undefined;
}

function hasTikTokBasicScope(value: unknown): boolean {
  return typeof value === 'string' &&
    value.split(/[,\s]+/).includes('user.info.basic');
}

export class OAuthProviderStageError extends Error {
  constructor(
    public readonly stage: 'token' | 'channel',
    message: string,
    public readonly reason?: OAuthProviderErrorReason,
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

export type FacebookPageCandidate = { id: string; name: string };
export type ExchangedFacebookPages = {
  tokenSecret: string;
  expiresAt: string;
  pages: FacebookPageCandidate[];
};

type FacebookPageToken = FacebookPageCandidate & { accessToken: string };
type FacebookSelectionBundle = {
  accessToken: string;
  userAccessToken: string;
  expiresAt: string;
  pages: FacebookPageToken[];
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
    // Cloudflare Workers does not support redirect: 'error'. A manual 3xx
    // is rejected below by response.ok, without forwarding credentials.
    redirect: 'manual',
    signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
  });
  if (!response.ok) {
    // Never expose a Google response body; only allowlisted, fixed error codes.
    if (url === socialOAuthProviders.youtube.tokenEndpoint) {
      let reason: GoogleTokenErrorReason | undefined;
      try {
        const body = object(JSON.parse(await boundedResponseText(response)));
        reason = safeGoogleTokenReason(body?.error);
      } catch {
        // Malformed remote response remains generic.
      }
      throw new GoogleTokenResponseError(reason);
    }
    if (url === 'https://youtube.googleapis.com/youtube/v3/channels?part=id&mine=true') {
      // Google documents youtubeSignupRequired for accounts without a channel.
      // Whitelist that exact structured error only; never read or log raw messages.
      try {
        const body = object(JSON.parse(await boundedResponseText(response)));
        const details = object(body?.error);
        const errors = Array.isArray(details?.errors) ? details.errors : [];
        if (errors.some((entry) => object(entry)?.reason === 'youtubeSignupRequired')) {
          throw new OAuthProfileError('no_channel');
        }
      } catch (error) {
        if (error instanceof OAuthProfileError) throw error;
      }
    }
    throw new Error('OAuth provider request unavailable.');
  }
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
  // TikTok OAuth v2 returns token fields at the root (not the legacy data envelope).
  if (response.error || response.error_description) {
    if (provider === 'youtube') {
      throw new GoogleTokenResponseError(safeGoogleTokenReason(response.error));
    }
    throw new Error('OAuth provider request unavailable.');
  }
  return response;
}

function profileHandle(provider: SocialOAuthProvider, value: unknown): string {
  // A successful token exchange alone does not prove a usable social profile.
  if (value === null || value === undefined || value === '') {
    throw new OAuthProfileError('profile_unavailable');
  }
  return accountHandle(provider, value);
}

async function accountHandleFor(
  provider: SocialOAuthProvider,
  token: Record<string, unknown>,
  accessToken: string,
  fetcher: typeof fetch,
): Promise<string> {
  if (provider === 'instagram') {
    return profileHandle(provider, token.user_id);
  }

  if (provider === 'tiktok') {
    return profileHandle(provider, token.open_id);
  }

  if (provider === 'youtube') {
    const profile = await requestJson(
      fetcher,
      'https://youtube.googleapis.com/youtube/v3/channels?part=id&mine=true',
      { headers: { Authorization: 'Bearer ' + accessToken } },
    );
    const items = profile.items;
    if (!Array.isArray(items)) {
      throw new Error('OAuth provider response unavailable.');
    }
    if (items.length === 0) {
      throw new OAuthProfileError('no_channel');
    }
    const channel = object(items[0]);
    return profileHandle(provider, channel?.id);
  }

  const profile = await requestJson(fetcher, 'https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: 'Bearer ' + accessToken },
  });
  return profileHandle(provider, profile.sub);
}

function facebookPageName(value: unknown): string {
  const name = requiredText(value, 200).trim();
  if (!name) throw new Error('OAuth provider response unavailable.');
  return name;
}

async function facebookPages(
  userAccessToken: string,
  fetcher: typeof fetch,
): Promise<FacebookPageToken[]> {
  const permissions = await requestJson(fetcher, `${FACEBOOK_GRAPH}/me/permissions`, {
    headers: { Authorization: 'Bearer ' + userAccessToken },
  });
  const granted = Array.isArray(permissions.data) && permissions.data.some((value) => {
    const permission = object(value);
    return permission?.permission === 'pages_show_list' && permission.status === 'granted';
  });
  if (!granted) throw new OAuthProfileError('permission_denied');

  const response = await requestJson(
    fetcher,
    `${FACEBOOK_GRAPH}/me/accounts?fields=id%2Cname%2Caccess_token&limit=${FACEBOOK_PAGE_LIMIT}`,
    { headers: { Authorization: 'Bearer ' + userAccessToken } },
  );
  if (!Array.isArray(response.data)) throw new Error('OAuth provider response unavailable.');
  if (response.data.length === 0) throw new OAuthProfileError('no_pages');
  if (response.data.length > FACEBOOK_PAGE_LIMIT) {
    throw new Error('OAuth provider response unavailable.');
  }
  const seen = new Set<string>();
  return response.data.map((value) => {
    const page = object(value);
    const id = requiredText(page?.id, 32);
    if (!/^[0-9]{1,32}$/.test(id) || seen.has(id)) {
      throw new Error('OAuth provider response unavailable.');
    }
    seen.add(id);
    return {
      id,
      name: facebookPageName(page?.name),
      accessToken: requiredText(page?.access_token),
    };
  });
}

async function facebookSelectionBundle(
  userAccessToken: string,
  expiresAt: string,
  fetcher: typeof fetch,
): Promise<FacebookSelectionBundle> {
  const pages = await facebookPages(userAccessToken, fetcher);
  return { accessToken: userAccessToken, userAccessToken, expiresAt, pages };
}

function parseFacebookSelectionBundle(value: string): FacebookSelectionBundle {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('Stored OAuth credential unavailable.');
  }
  const bundle = object(parsed);
  if (
    !bundle ||
    !Array.isArray(bundle.pages) ||
    bundle.pages.length < 1 ||
    bundle.pages.length > FACEBOOK_PAGE_LIMIT
  ) {
    throw new Error('Stored OAuth credential unavailable.');
  }
  const accessToken = requiredText(bundle.accessToken);
  const userAccessToken = requiredText(bundle.userAccessToken);
  const expiresAt = requiredText(bundle.expiresAt, 64);
  const pages = bundle.pages.map((value) => {
    const page = object(value);
    if (
      !page ||
      typeof page.id !== 'string' ||
      !/^[0-9]{1,32}$/.test(page.id)
    ) {
      throw new Error('Stored OAuth credential unavailable.');
    }
    return {
      id: page.id,
      name: facebookPageName(page.name),
      accessToken: requiredText(page.accessToken),
    };
  });
  if (new Set(pages.map((page) => page.id)).size !== pages.length) {
    throw new Error('Stored OAuth credential unavailable.');
  }
  return {
    accessToken,
    userAccessToken,
    expiresAt,
    pages,
  };
}

export async function exchangeFacebookOAuthCode(input: {
  config: SocialOAuthRuntimeConfig;
  redirectUri: string;
  authorizationCode: string;
  fetcher?: typeof fetch;
  now?: Date;
}): Promise<ExchangedFacebookPages> {
  const fetcher = input.fetcher ?? fetch;
  let userAccessToken: string;
  let expiresAt: string;
  try {
    const token = await tokenResponse(
      'facebook',
      input.config,
      input.redirectUri,
      input.authorizationCode,
      null,
      fetcher,
    );
    userAccessToken = requiredText(token.access_token);
    const expiresIn = Number(token.expires_in);
    if (!Number.isSafeInteger(expiresIn) || expiresIn < 60 || expiresIn > 31_536_000) {
      throw new Error('OAuth provider response unavailable.');
    }
    expiresAt = new Date(
      (input.now ?? new Date()).getTime() + expiresIn * 1000,
    ).toISOString();
  } catch {
    throw new OAuthProviderStageError(
      'token',
      'OAuth provider response unavailable.',
    );
  }

  try {
    const bundle = await facebookSelectionBundle(userAccessToken, expiresAt, fetcher);
    return {
      tokenSecret: JSON.stringify(bundle),
      expiresAt,
      pages: bundle.pages.map(({ id, name }) => ({ id, name })),
    };
  } catch (error) {
    try {
      await revokeSocialOAuthToken({
        provider: 'facebook',
        config: input.config,
        tokenSecret: JSON.stringify({
          accessToken: userAccessToken,
          userAccessToken,
          expiresAt,
        }),
        fetcher,
        ...(input.now ? { now: input.now } : {}),
      });
    } catch {}
    throw new OAuthProviderStageError(
      'channel',
      'OAuth provider response unavailable.',
      error instanceof OAuthProfileError ? error.reason : undefined,
    );
  }
}

export async function refreshFacebookPageSelection(input: {
  tokenSecret: string;
  fetcher?: typeof fetch;
  now?: Date;
}): Promise<ExchangedFacebookPages> {
  try {
    const bundle = parseFacebookSelectionBundle(input.tokenSecret);
    const expiresAt = Date.parse(bundle.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= (input.now ?? new Date()).getTime()) {
      throw new Error('Stored OAuth credential unavailable.');
    }
    const refreshed = await facebookSelectionBundle(
      bundle.userAccessToken,
      bundle.expiresAt,
      input.fetcher ?? fetch,
    );
    return {
      tokenSecret: JSON.stringify(refreshed),
      expiresAt: bundle.expiresAt,
      pages: refreshed.pages.map(({ id, name }) => ({ id, name })),
    };
  } catch (error) {
    throw new OAuthProviderStageError(
      'channel',
      'OAuth provider response unavailable.',
      error instanceof OAuthProfileError ? error.reason : undefined,
    );
  }
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
    if (input.provider === 'tiktok' && !hasTikTokBasicScope(token.scope)) {
      throw new Error('OAuth provider response unavailable.');
    }
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
    throw new OAuthProviderStageError(
      'token',
      safeMessage,
      error instanceof GoogleTokenResponseError ? error.reason : undefined,
    );
  }
  const expiresAt = new Date(
    (input.now ?? new Date()).getTime() + expiresIn * 1000,
  ).toISOString();
  const tokenBundle: OAuthTokenBundle = { accessToken, expiresAt };
  const tokenSecret = JSON.stringify(tokenBundle);
  let handle: string;
  try {
    handle = await accountHandleFor(input.provider, token, accessToken, fetcher);
  } catch (error) {
    try {
      await revokeSocialOAuthToken({
        provider: input.provider,
        config: input.config,
        tokenSecret,
        fetcher,
        ...(input.now ? { now: input.now } : {}),
      });
    } catch {}
    throw new OAuthProviderStageError(
      'channel',
      'OAuth provider response unavailable.',
      error instanceof OAuthProfileError ? error.reason : undefined,
    );
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
  let userAccessToken: string | null = null;
  try {
    const parsed: unknown = JSON.parse(input.tokenSecret);
    const value = object(parsed);
    bundle = {
      accessToken: requiredText(value?.accessToken),
      expiresAt: requiredText(value?.expiresAt, 64),
    };
    if (input.provider === 'facebook') {
      userAccessToken = requiredText(value?.userAccessToken);
    }
  } catch {
    throw new Error('Stored OAuth credential unavailable.');
  }
  const expiresAt = Date.parse(bundle.expiresAt);
  if (!Number.isFinite(expiresAt)) {
    throw new Error('Stored OAuth credential unavailable.');
  }
  if (expiresAt <= (input.now ?? new Date()).getTime()) {
    // Expiry is not evidence that the provider grant was revoked.
    throw new Error('OAuth provider revocation unconfirmed.');
  }

  const body =
    input.provider === 'tiktok'
      ? formBody({
          client_key: input.config.clientId,
          client_secret: input.config.clientSecret,
          token: bundle.accessToken,
        })
      : formBody({ token: bundle.accessToken });
  const response = await (input.fetcher ?? fetch)(definition.revocationEndpoint, {
    method: input.provider === 'facebook' ? 'DELETE' : 'POST',
    headers: input.provider === 'facebook'
      ? { Authorization: 'Bearer ' + userAccessToken }
      : { 'Content-Type': 'application/x-www-form-urlencoded' },
    ...(input.provider === 'facebook' ? {} : { body }),
    cache: 'no-store',
    credentials: 'omit',
    redirect: 'manual',
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
    if (input.provider === 'facebook' &&
      responseBody !== true && object(responseBody)?.success !== true) {
      throw new Error('OAuth provider response unavailable.');
    }
  } else if (input.provider === 'facebook') {
    throw new Error('OAuth provider response unavailable.');
  }
}
