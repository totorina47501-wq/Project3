import 'server-only';

type McpOAuthConfig = {
  resourceServerUrl: URL;
  oauthMetadata: {
    issuer: string;
    authorization_endpoint: string;
    token_endpoint: string;
    jwks_uri?: string;
    registration_endpoint?: string;
    revocation_endpoint?: string;
    response_types_supported: string[];
    grant_types_supported: string[];
    token_endpoint_auth_methods_supported: string[];
    code_challenge_methods_supported: string[];
    scopes_supported: string[];
  };
  serviceDocumentationUrl?: URL;
};

function readHttpsUrl(name: string): URL | null {
  const raw = process.env[name];
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    return url;
  } catch { return null; }
}

/**
 * The resource identifier is operator-controlled: never derive a bearer
 * audience from the untrusted Host / forwarded request URL.
 */
function configuredResourceUrl(): URL | null {
  const url = readHttpsUrl('MCP_RESOURCE_SERVER_URL');
  if (!url || url.pathname !== '/api/mcp' || url.search || url.hash
    || url.username || url.password) return null;
  return url;
}

export function mcpResourceServerUrl(_request: Request): URL {
  const url = configuredResourceUrl();
  if (!url) throw new Error('MCP resource configuration unavailable.');
  return url;
}

export function mcpOAuthConfig(_request: Request): McpOAuthConfig | null {
  const issuer = readHttpsUrl('MCP_OAUTH_ISSUER');
  const authorizationEndpoint = readHttpsUrl('MCP_OAUTH_AUTHORIZATION_ENDPOINT');
  const tokenEndpoint = readHttpsUrl('MCP_OAUTH_TOKEN_ENDPOINT');
  const resourceServerUrl = configuredResourceUrl();
  if (!issuer || !authorizationEndpoint || !tokenEndpoint || !resourceServerUrl) return null;
  const jwks = readHttpsUrl('MCP_OAUTH_JWKS_URI');
  const registration = readHttpsUrl('MCP_OAUTH_REGISTRATION_ENDPOINT');
  const revocation = readHttpsUrl('MCP_OAUTH_REVOCATION_ENDPOINT');
  const docs = readHttpsUrl('MCP_SERVICE_DOCUMENTATION_URL');
  return {
    resourceServerUrl,
    oauthMetadata: {
      issuer: issuer.toString(),
      authorization_endpoint: authorizationEndpoint.toString(),
      token_endpoint: tokenEndpoint.toString(),
      ...(jwks ? { jwks_uri: jwks.toString() } : {}),
      ...(registration ? { registration_endpoint: registration.toString() } : {}),
      ...(revocation ? { revocation_endpoint: revocation.toString() } : {}),
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['none'],
      code_challenge_methods_supported: ['S256'],
      scopes_supported: ['checks:read', 'checks:write'],
    },
    ...(docs ? { serviceDocumentationUrl: docs } : {}),
  };
}
