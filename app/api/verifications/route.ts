// Chemin : app/api/verifications/route.ts
import { requireUser, publicError } from '@/lib/security/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { client } = await requireUser();
    const url = new URL(request.url);
    const page = Math.max(1, Math.min(1000, Number(url.searchParams.get('page')) || 1));
    const limit = 10;
    const from = (page - 1) * limit;
    // Le navigateur et le serveur utilisent la session JWT + les RLS.
    const { data, error, count } = await client.from('verifications')
      .select('id,platform,content_text,ai_score,ai_risk_level,status,created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1);
    if (error) throw new Error('Lecture impossible.');
    return Response.json({ items: data ?? [], count: count ?? 0, page }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    const { status, message } = publicError(error);
    return Response.json({ error: message }, { status });
  }
}
