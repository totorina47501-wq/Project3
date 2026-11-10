import 'server-only';

export const socialOAuthProviders = {
  instagram: {
    authorizationEndpoint: 'https://www.instagram.com/oauth/authorize',
    tokenEndpoint: 'https://api.instagram.com/oauth/access_token',
    revocationEndpoint: null,
    enabledEnv: 'SOCIAL_OAUTH_INSTAGRAM_ENABLED',
    clientIdParameter: 'client_id',
    clientIdEnv: 'SOCIAL_OAUTH_INSTAGRAM_CLIENT_ID',
    clientSecretEnv: 'SOCIAL_OAUTH_INSTAGRAM_CLIENT_SECRET',
    pkce: false,
    scopeSeparator: ',',
    scopes: ['instagram_business_basic'],
  },
  tiktok: {
    authorizationEndpoint: 'https://www.tiktok.com/v2/auth/authorize/',
    tokenEndpoint: 'https://open.tiktokapis.com/v2/oauth/token/',
    revocationEndpoint: 'https://open.tiktokapis.com/v2/oauth/revoke/',
    enabledEnv: 'SOCIAL_OAUTH_TIKTOK_ENABLED',
    clientIdParameter: 'client_key',
    clientIdEnv: 'SOCIAL_OAUTH_TIKTOK_CLIENT_KEY',
    clientSecretEnv: 'SOCIAL_OAUTH_TIKTOK_CLIENT_SECRET',
    pkce: false,
    scopeSeparator: ',',
    scopes: ['user.info.basic'],
  },
  youtube: {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
    enabledEnv: 'SOCIAL_OAUTH_YOUTUBE_ENABLED',
    clientIdParameter: 'client_id',
    clientIdEnv: 'SOCIAL_OAUTH_YOUTUBE_CLIENT_ID',
    clientSecretEnv: 'SOCIAL_OAUTH_YOUTUBE_CLIENT_SECRET',
    pkce: true,
    scopeSeparator: ' ',
    scopes: ['https://www.googleapis.com/auth/youtube.readonly'],
  },
  linkedin: {
    authorizationEndpoint: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenEndpoint: 'https://www.linkedin.com/oauth/v2/accessToken',
    revocationEndpoint: null,
    enabledEnv: 'SOCIAL_OAUTH_LINKEDIN_ENABLED',
    clientIdParameter: 'client_id',
    clientIdEnv: 'SOCIAL_OAUTH_LINKEDIN_CLIENT_ID',
    clientSecretEnv: 'SOCIAL_OAUTH_LINKEDIN_CLIENT_SECRET',
    pkce: false,
    scopeSeparator: ' ',
    scopes: ['openid', 'profile'],
  },
} as const;

export type SocialOAuthProvider = keyof typeof socialOAuthProviders;

export type SocialOAuthRuntimeConfig = {
  provider: SocialOAuthProvider;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  allowedOrigins: string[];
};

const callbackPath = (provider: SocialOAuthProvider) =>
  `/api/social-accounts/oauth/callback/${provider}`;

export function socialOAuthConfig(
  provider: SocialOAuthProvider,
  env: Record<string, string | undefined> = process.env,
): SocialOAuthRuntimeConfig | null {
  if (
    env.SOCIAL_OAUTH_ENABLED !== 'true' ||
    env[socialOAuthProviders[provider].enabledEnv] !== 'true'
  ) return null;

  const definition = socialOAuthProviders[provider];
  const clientId = env[definition.clientIdEnv];
  const clientSecret = env[definition.clientSecretEnv];
  const publicOrigin = env.SOCIAL_OAUTH_PUBLIC_ORIGIN;
  const allowedOrigins = (env.SOCIAL_OAUTH_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (!clientId || !clientSecret || !publicOrigin) return null;

  try {
    const originUrl = new URL(publicOrigin);
    if (
      originUrl.protocol !== 'https:' ||
      originUrl.origin !== publicOrigin ||
      !allowedOrigins.includes(originUrl.origin)
    ) {
      return null;
    }

    return {
      provider,
      clientId,
      clientSecret,
      redirectUri: new URL(callbackPath(provider), originUrl).toString(),
      allowedOrigins: [originUrl.origin],
    };
  } catch {
    return null;
  }
}
