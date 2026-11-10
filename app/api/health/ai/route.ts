import { openaiReadiness } from '@/lib/openai/config';

// Diagnostic non authentifié : aucune requête OpenAI et aucune clé exposée.
// La présence d'une clé et des flags ne démontre pas qu'un appel modèle réussit.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(): Response {
  const ai = openaiReadiness(process.env);
  const configured = ai.keyConfigured && ai.textEnabled && ai.visionEnabled;
  return Response.json(
    {
      service: 'mentioncheck-ai',
      probe: 'ai-prod-20261110',
      status: configured ? 'configured' : 'not_configured',
    },
    {
      status: configured ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Robots-Tag': 'noindex, nofollow',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  );
}
