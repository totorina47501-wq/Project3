import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), limiter: vi.fn() }));

vi.mock('server-only', () => ({}));
vi.mock('../../lib/supabase/admin', () => ({ createAdminSupabase: () => ({ rpc: mocks.rpc }) }));
vi.mock('../../lib/security/rate-limit', () => ({ checkRateLimit: mocks.limiter }));

import { GET as wellKnownGet } from '../../app/.well-known/[...metadata]/route';
import { POST as mcpPost } from '../../app/api/mcp/route';

function b64url(value: Uint8Array): string {
  return Buffer.from(value).toString('base64url');
}

async function sign(payloadB64: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64))));
}

async function token(scopes: string[], overrides: Partial<Record<string, unknown>> = {}) {
  const payload = {
    v: 1,
    clientId: 'mcp-test-client',
    scopes,
    studioKeyHash: 'b'.repeat(64),
    exp: Math.floor(Date.now() / 1000) + 600,
    resource: 'https://mentioncheck.test/api/mcp',
    ...overrides,
  };
  const payloadB64 = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await sign(payloadB64, process.env.MCP_TOKEN_HMAC_SECRET!);
  return `mc_mcp_${payloadB64}.${signature}`;
}

function modernRequest(method: string, body: unknown, auth: string, name?: string) {
  const requestBody = body as { params?: Record<string, unknown> };
  const params = requestBody.params ?? {};
  requestBody.params = {
    ...params,
    _meta: {
      ...(typeof params._meta === 'object' && params._meta ? params._meta as Record<string, unknown> : {}),
      'io.modelcontextprotocol/protocolVersion': '2026-07-28',
      'io.modelcontextprotocol/clientCapabilities': {},
    },
  };
  return new Request('https://mentioncheck.test/api/mcp', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${auth}`,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': '2026-07-28',
      'mcp-method': method,
      ...(name ? { 'mcp-name': name } : {}),
    },
    body: JSON.stringify(requestBody),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.MCP_TOKEN_HMAC_SECRET = 'x'.repeat(32);
  process.env.MCP_RESOURCE_SERVER_URL = 'https://mentioncheck.test/api/mcp';
  process.env.MCP_OAUTH_ISSUER = 'https://auth.mentioncheck.test';
  process.env.MCP_OAUTH_AUTHORIZATION_ENDPOINT = 'https://auth.mentioncheck.test/oauth/authorize';
  process.env.MCP_OAUTH_TOKEN_ENDPOINT = 'https://auth.mentioncheck.test/oauth/token';
  mocks.limiter.mockResolvedValue(undefined);
  mocks.rpc.mockImplementation((_name: string, payload: { p_action: string }) => {
    if (payload.p_action === 'checks') return Promise.resolve({ data: { items: [{ id: 'v1' }], limit: 100 }, error: null });
    if (payload.p_action === 'save_check') return Promise.resolve({ data: { verification: { id: 'v2' } }, error: null });
    return Promise.resolve({ data: null, error: { code: '22023' } });
  });
});

describe('MCP distant Studio', () => {
  it('publie le discovery OAuth pour la ressource MCP', async () => {
    const response = await wellKnownGet(new Request('https://mentioncheck.test/.well-known/oauth-protected-resource/api/mcp'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.resource).toBe('https://mentioncheck.test/api/mcp');
  });

  it('retourne un catalogue tools/list déterministe', async () => {
    const auth = await token(['checks:read', 'checks:write']);
    const response = await mcpPost(modernRequest('tools/list', {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {},
    }, auth));
    expect(response.status).toBe(200);
    const body = await response.json();
    const names = (body.result.tools as Array<{ name: string }>).map((tool) => tool.name).sort();
    expect(names).toEqual(['check_content', 'list_verifications']);
  });

  it('appelle studio_execute_api save_check avec le hash délégué du token MCP', async () => {
    const auth = await token(['checks:write']);
    const response = await mcpPost(modernRequest('tools/call', {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'check_content',
        arguments: { caption: 'Publicité', platform: 'instagram' },
      },
    }, auth, 'check_content'));
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('studio_execute_api', expect.objectContaining({
      p_hash: 'b'.repeat(64),
      p_action: 'save_check',
      p_payload: expect.objectContaining({
        caption: 'Publicité',
        platform: 'instagram',
      }),
    }));
  });

  it('refuse un token invalide avant tout appel RPC', async () => {
    const response = await mcpPost(modernRequest('tools/list', {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/list',
      params: {},
    }, 'mc_mcp_invalid.invalid'));
    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toContain('resource_metadata=');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['absence d’audience resource', undefined],
    ['audience d’une autre ressource', 'https://example.invalid/api/mcp'],
  ])('refuse le bearer signé : %s', async (_name, resource) => {
    const bearer = await token(['checks:read'], { resource });
    const response = await mcpPost(modernRequest('tools/list', {
      jsonrpc: '2.0',
      id: 31,
      method: 'tools/list',
      params: {},
    }, bearer));
    expect([401, 403]).toContain(response.status);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('refuse un bearer MCP expiré sans toucher Studio', async () => {
    const bearer = await token(['checks:read'], { exp: Math.floor(Date.now() / 1000) - 1 });
    const response = await mcpPost(modernRequest('tools/list', {
      jsonrpc: '2.0',
      id: 32,
      method: 'tools/list',
      params: {},
    }, bearer));
    expect([401, 403]).toContain(response.status);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('n’autorise pas check_content sans scope checks:write', async () => {
    const auth = await token(['checks:read']);
    const response = await mcpPost(modernRequest('tools/call', {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'check_content',
        arguments: { caption: 'Publicité', platform: 'instagram' },
      },
    }, auth, 'check_content'));
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(JSON.stringify(body)).toContain('insufficient_scope');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('conserve la compatibilité legacy initialize via le fallback SDK', async () => {
    const auth = await token(['checks:read']);
    const response = await mcpPost(new Request('https://mentioncheck.test/api/mcp', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${auth}`,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 5,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: { name: 'legacy-test', version: '1.0.0' },
        },
      }),
    }));
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('protocolVersion');
  });
});
