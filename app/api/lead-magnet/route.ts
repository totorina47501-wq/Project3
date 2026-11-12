import { LEAD_MAGNET_FILENAME, leadMagnetText } from '@/lib/marketing/lead-magnet';

export const runtime = 'nodejs';

export async function GET() {
  return new Response(leadMagnetText(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${LEAD_MAGNET_FILENAME}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
