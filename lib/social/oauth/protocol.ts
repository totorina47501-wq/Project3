import {
  socialOAuthConfig,
  socialOAuthProviders,
  type SocialOAuthProvider,
  type SocialOAuthRuntimeConfig,
} from './providers';

export const SOCIAL_OAUTH_STATE_TTL_SECONDS = 600;

export type OAuthTransaction = {
  userId: string;
  sessionId: string;
  provider: SocialOAuthProvider;
  stateHash: string;
  pkceVerifier: string | null;
  redirectUri: string;
  expiresAt: string;
};

export type OAuthTransactionStore = {
  create(transaction: OAuthTransaction): Promise<void>;
  consume(input: {
    userId: string;
    sessionId: string;
    provider: SocialOAuthProvider;
    stateHash: string;
  }): Promise<OAuthTransaction | null>;
};

export class SocialOAuthError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function randomUrlSafeValue(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function oauthValueHash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

function validateRedirect(config: SocialOAuthRuntimeConfig): URL {
  let redirect: URL;
  try {
    redirect = new URL(config.redirectUri);
  } catch {
    throw new SocialOAuthError(503, 'La connexion fournisseur n’est pas disponible.');
  }
  const expectedPath = `/api/social-accounts/oauth/callback/${config.provider}`;
  if (
    redirect.protocol !== 'https:' ||
    redirect.username ||
    redirect.password ||
    redirect.search ||
    redirect.hash ||
    redirect.pathname !== expectedPath ||
    !config.allowedOrigins.includes(redirect.origin)
  ) {
    throw new SocialOAuthError(503, 'La connexion fournisseur n’est pas disponible.');
  }
  return redirect;
}

export async function beginSocialOAuth(input: {
  provider: SocialOAuthProvider;
  userId: string;
  sessionId: string;
  store: OAuthTransactionStore;
  config?: SocialOAuthRuntimeConfig | null;
  now?: Date;
}): Promise<URL> {
  const config =
    input.config === undefined ? socialOAuthConfig(input.provider) : input.config;
  if (!config || config.provider !== input.provider) {
    throw new SocialOAuthError(503, 'La connexion fournisseur n’est pas disponible.');
  }
  if (!input.userId || !input.sessionId) {
    throw new SocialOAuthError(401, 'Connecte-toi pour continuer.');
  }

  const redirect = validateRedirect(config);
  const definition = socialOAuthProviders[input.provider];
  const state = randomUrlSafeValue();
  const verifier = definition.pkce ? randomUrlSafeValue() : null;
  const now = input.now ?? new Date();
  const expiresAt = new Date(
    now.getTime() + SOCIAL_OAUTH_STATE_TTL_SECONDS * 1000,
  ).toISOString();

  await input.store.create({
    userId: input.userId,
    sessionId: input.sessionId,
    provider: input.provider,
    stateHash: await oauthValueHash(state),
    pkceVerifier: verifier,
    redirectUri: redirect.toString(),
    expiresAt,
  });

  const authorizationUrl = new URL(definition.authorizationEndpoint);
  authorizationUrl.searchParams.set(definition.clientIdParameter, config.clientId);
  authorizationUrl.searchParams.set('redirect_uri', redirect.toString());
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('scope', definition.scopes.join(' '));
  authorizationUrl.searchParams.set('state', state);
  if (verifier) {
    authorizationUrl.searchParams.set('code_challenge', await pkceChallenge(verifier));
    authorizationUrl.searchParams.set('code_challenge_method', 'S256');
  }
  return authorizationUrl;
}

function callbackParameter(url: URL, name: string): string | null {
  const values = url.searchParams.getAll(name);
  if (values.length > 1) {
    throw new SocialOAuthError(400, 'Réponse fournisseur invalide.');
  }
  return values[0] ?? null;
}

export async function completeSocialOAuthCallback(input: {
  provider: SocialOAuthProvider;
  userId: string;
  sessionId: string;
  callbackUrl: string;
  store: OAuthTransactionStore;
  config?: SocialOAuthRuntimeConfig | null;
  now?: Date;
}): Promise<{ authorizationCode: string; codeVerifier: string | null }> {
  const config =
    input.config === undefined ? socialOAuthConfig(input.provider) : input.config;
  if (!config || config.provider !== input.provider) {
    throw new SocialOAuthError(503, 'La connexion fournisseur n’est pas disponible.');
  }
  if (!input.userId || !input.sessionId) {
    throw new SocialOAuthError(401, 'Connecte-toi pour continuer.');
  }

  const expectedRedirect = validateRedirect(config);
  let callback: URL;
  try {
    callback = new URL(input.callbackUrl);
  } catch {
    throw new SocialOAuthError(400, 'Réponse fournisseur invalide.');
  }
  if (
    callback.origin !== expectedRedirect.origin ||
    callback.pathname !== expectedRedirect.pathname ||
    callback.username ||
    callback.password ||
    input.callbackUrl.includes('#')
  ) {
    throw new SocialOAuthError(400, 'Réponse fournisseur invalide.');
  }

  const allowedParameters = new Set([
    'state',
    'code',
    'error',
    'error_description',
    'error_uri',
  ]);
  if ([...callback.searchParams.keys()].some((key) => !allowedParameters.has(key))) {
    throw new SocialOAuthError(400, 'Réponse fournisseur invalide.');
  }
  for (const parameter of allowedParameters) callbackParameter(callback, parameter);

  const state = callbackParameter(callback, 'state');
  const code = callbackParameter(callback, 'code');
  const providerError = callbackParameter(callback, 'error');
  if (
    !state ||
    !/^[A-Za-z0-9_-]{43}$/.test(state) ||
    (code === null) === (providerError === null) ||
    ((callback.searchParams.has('error_description') || callback.searchParams.has('error_uri')) &&
      providerError === null) ||
    (code !== null && (!code || code.length > 4096 || /[\u0000-\u001f\u007f]/.test(code)))
  ) {
    throw new SocialOAuthError(400, 'Réponse fournisseur invalide.');
  }

  const transaction = await input.store.consume({
    userId: input.userId,
    sessionId: input.sessionId,
    provider: input.provider,
    stateHash: await oauthValueHash(state),
  });
  const expiresAt = Date.parse(transaction?.expiresAt ?? '');
  if (
    !transaction ||
    transaction.userId !== input.userId ||
    transaction.sessionId !== input.sessionId ||
    transaction.provider !== input.provider ||
    transaction.redirectUri !== expectedRedirect.toString() ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= (input.now ?? new Date()).getTime()
  ) {
    throw new SocialOAuthError(400, 'Réponse fournisseur invalide ou expirée.');
  }
  if (providerError !== null) {
    throw new SocialOAuthError(400, 'La connexion fournisseur a été annulée.');
  }

  return { authorizationCode: code!, codeVerifier: transaction.pkceVerifier };
}
