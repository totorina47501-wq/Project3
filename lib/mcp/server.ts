import 'server-only';
import { z } from 'zod';
import {
  AuthInfo,
  McpServer,
  OAuthError,
  OAuthErrorCode,
  createMcpHandler,
  getOAuthProtectedResourceMetadataUrl,
  requireBearerAuth,
  requireScopes,
} from '@modelcontextprotocol/server';
import { studioApiRpcWithHash } from '@/lib/studio/server';
import { publicError } from '@/lib/security/auth';
import { studioCheckSchema } from '@/lib/studio/schemas';
import { mcpOAuthConfig, mcpResourceServerUrl } from '@/lib/mcp/config';
import { createMcpTokenVerifier } from '@/lib/mcp/auth';

const checksScope = requireScopes('checks:write');
const readScope = requireScopes('checks:read');

const checkOutputSchema = z.object({
  verification: z.record(z.string(), z.unknown()),
});
const listOutputSchema = z.object({
  items: z.array(z.record(z.string(), z.unknown())),
  limit: z.literal(100),
});

function mcpError(error: unknown) {
  // Preserve known business statuses without returning SDK/DB internals.
  const { status, message } = publicError(error);
  return {
    isError: true,
    content: [{ type: 'text' as const, text: message }],
    structuredContent: { ok: false, status, error: message },
  };
}

function isAllowedOrigin(request: Request, resourceUrl: URL): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // Native/non-browser MCP clients often omit Origin.
  try {
    const parsed = new URL(origin);
    if (origin !== parsed.origin || parsed.protocol !== 'https:') return false;
    const extra = (process.env.MCP_ALLOWED_ORIGINS ?? '')
      .split(',').map(value => value.trim()).filter(Boolean)
      .filter(value => {
        try {
          const url = new URL(value);
          return url.protocol === 'https:' && url.origin === value;
        } catch { return false; }
      });
    return origin === resourceUrl.origin || extra.includes(origin);
  } catch { return false; }
}

function studioKeyHash(authInfo: AuthInfo | undefined): string {
  const value = authInfo?.extra?.studioKeyHash;
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value))
    throw new OAuthError(OAuthErrorCode.InvalidToken, 'Invalid bearer token.');
  return value;
}

const mcpHandler = createMcpHandler(() => {
  const server = new McpServer({
    name: 'mentioncheck-remote-studio',
    version: '0.1.0',
  });

  server.registerTool(
    'check_content',
    {
      title: 'Contrôler une légende Studio',
      description: 'Contrôle SafePublish rules_only via l’API Studio existante.',
      inputSchema: studioCheckSchema,
      outputSchema: checkOutputSchema,
      scopeChallenge: checksScope,
      _meta: {
        'mentioncheck.cost': 'none',
        'mentioncheck.mode': 'rules_only',
      },
    },
    async (input, ctx) => {
      try {
        const verification = await studioApiRpcWithHash(
          studioKeyHash(ctx.http?.authInfo),
          'save_check',
          input,
        );
        return {
          content: [{ type: 'text', text: 'Vérification Studio enregistrée (rules_only).' }],
          structuredContent: checkOutputSchema.parse(verification),
        };
      } catch (error) {
        return mcpError(error);
      }
    },
  );

  server.registerTool(
    'list_verifications',
    {
      title: 'Lister les vérifications Studio',
      description: 'Retourne les 100 dernières vérifications de l’espace autorisé.',
      outputSchema: listOutputSchema,
      scopeChallenge: readScope,
      _meta: {
        'mentioncheck.cost': 'none',
        'mentioncheck.mode': 'read_only',
      },
    },
    async (ctx) => {
      try {
        const checks = await studioApiRpcWithHash(studioKeyHash(ctx.http?.authInfo), 'checks');
        return {
          content: [{ type: 'text', text: 'Historique Studio limité au workspace autorisé.' }],
          structuredContent: listOutputSchema.parse(checks),
        };
      } catch (error) {
        return mcpError(error);
      }
    },
  );

  return server;
});

export async function handleMcpRequest(request: Request): Promise<Response> {
  const oauth = mcpOAuthConfig(request);
  if (!oauth) {
    return Response.json(
      { error: 'MCP OAuth metadata unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
  if (!isAllowedOrigin(request, oauth.resourceServerUrl)) {
    return Response.json(
      { error: 'MCP origin not allowed.' },
      { status: 403, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
  const gate = requireBearerAuth({
    verifier: createMcpTokenVerifier(request),
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(mcpResourceServerUrl(request)),
  });
  const auth = await gate(request);
  if (auth instanceof Response) return auth;
  return mcpHandler.fetch(request, { authInfo: auth });
}
