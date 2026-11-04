// Liste du stockage préparé : l'accès direct aux autres comptes est interdit par RLS.
import { requireUser, publicError } from '@/lib/security/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const { client } = await requireUser();
    const { data, error } = await client.from('media_assets')
      .select('id,group_id,kind,status,mime_type,declared_bytes,duration_seconds,created_at,expires_at')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }).limit(50);
    if (error) throw new Error('Bibliothèque indisponible.');
    return Response.json({ items: data ?? [] }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    const { status, message } = publicError(error);
    return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
