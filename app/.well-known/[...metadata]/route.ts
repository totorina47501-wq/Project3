import { oauthMetadataResponse } from '@modelcontextprotocol/server';
import { mcpOAuthConfig } from '@/lib/mcp/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function metadata(request: Request): Response {
  const config = mcpOAuthConfig();
  if (!config) {
    return Response.json(
      { error: 'MCP OAuth metadata unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
  const response = oauthMetadataResponse(request, {
    oauthMetadata: config.oauthMetadata,
    resourceServerUrl: config.resourceServerUrl,
    scopesSupported: ['checks:read', 'checks:write'],
    resourceName: 'MentionCheck MCP Studio (development)',
    ...(config.serviceDocumentationUrl ? { serviceDocumentationUrl: config.serviceDocumentationUrl } : {}),
  });
  if (response) return response;
  return Response.json({ error: 'Not found.' }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
}

export async function GET(request: Request) {
  return metadata(request);
}

export async function OPTIONS(request: Request) {
  return metadata(request);
}
