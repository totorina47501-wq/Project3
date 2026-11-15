import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { AuthInfo, OAuthError, OAuthErrorCode, type OAuthTokenVerifier } from '@modelcontextprotocol/server';
import { mcpResourceServerUrl } from '@/lib/mcp/config';

type McpTokenPayload = {
  v: 1;
  clientId: string;
  scopes: string[];
  studioKeyHash: string;
  exp: number;
  resource: string;
};

function hmacSecret(): string {
  const secret = process.env.MCP_TOKEN_HMAC_SECRET?.trim();
  if (!secret || secret.length < 32) throw new OAuthError(OAuthErrorCode.ServerError, 'MCP token verifier unavailable.');
  return secret;
}

function b64url(value: Uint8Array): string {
  return Buffer.from(value).toString('base64url');
}

function parseToken(token: string) {
  const match = token.match(/^mc_mcp_([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/);
  if (!match) throw new OAuthError(OAuthErrorCode.InvalidToken, 'Invalid bearer token.');
  return { payloadB64: match[1]!, signatureB64: match[2]! };
}

function parsePayload(payloadB64: string): McpTokenPayload {
  let raw = '';
  try { raw = Buffer.from(payloadB64, 'base64url').toString('utf8'); }
  catch { throw new OAuthError(OAuthErrorCode.InvalidToken, 'Invalid bearer token.'); }
  let payload: unknown;
  try { payload = JSON.parse(raw); }
  catch { throw new OAuthError(OAuthErrorCode.InvalidToken, 'Invalid bearer token.'); }
  if (typeof payload !== 'object' || payload === null)
    throw new OAuthError(OAuthErrorCode.InvalidToken, 'Invalid bearer token.');
  const record = payload as Record<string, unknown>;
  if (
    record.v !== 1 ||
    typeof record.clientId !== 'string' ||
    !Array.isArray(record.scopes) ||
    !record.scopes.every((scope: unknown) => typeof scope === 'string') ||
    typeof record.studioKeyHash !== 'string' ||
    !/^[0-9a-f]{64}$/.test(record.studioKeyHash) ||
    !Number.isFinite(record.exp) ||
    !Number.isInteger(record.exp)
  ) throw new OAuthError(OAuthErrorCode.InvalidToken, 'Invalid bearer token.');
  const typed = record as unknown as McpTokenPayload;
  if (typeof typed.resource !== 'string' || !typed.resource.trim())
    throw new OAuthError(OAuthErrorCode.InvalidToken, 'Invalid bearer token.');
  return typed;
}

async function verifySignature(payloadB64: string, signatureB64: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(hmacSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64)));
  const expected = b64url(digest);
  const left = Buffer.from(expected);
  const right = Buffer.from(signatureB64);
  if (left.length !== right.length || !timingSafeEqual(left, right))
    throw new OAuthError(OAuthErrorCode.InvalidToken, 'Invalid bearer token.');
}

export function createMcpTokenVerifier(): OAuthTokenVerifier {
  const resource = mcpResourceServerUrl().toString();
  return {
    verifyAccessToken: async (token) => {
      const { payloadB64, signatureB64 } = parseToken(token);
      const payload = parsePayload(payloadB64);
      await verifySignature(payloadB64, signatureB64);
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp <= now || payload.exp > now + 3600)
        throw new OAuthError(OAuthErrorCode.InvalidToken, 'Expired or overlong bearer token.');
      if (payload.resource !== resource)
        throw new OAuthError(OAuthErrorCode.InvalidTarget, 'Bearer token audience mismatch.');
      return {
        token,
        clientId: payload.clientId,
        scopes: [...new Set(payload.scopes)],
        expiresAt: payload.exp,
        resource: new URL(resource),
        extra: { studioKeyHash: payload.studioKeyHash },
      } satisfies AuthInfo;
    },
  };
}
