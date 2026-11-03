// Chemin : app/api/mia/conversations/route.ts
import { requireUser, publicError } from '@/lib/security/auth';
import { miaMessageSchema } from '@/lib/mia/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const { client } = await requireUser();
    const { data, error } = await client.from('assistant_conversations')
      .select('id,verification_id,updated_at,messages')
      .order('updated_at', { ascending: false }).limit(15);
    if (error) throw new Error('Historique indisponible.');
    const conversations = (data ?? []).map((row) => {
      const raw = Array.isArray(row.messages) ? row.messages : [];
      const messages = raw.flatMap((item) => {
        const parsed = miaMessageSchema.safeParse(item);
        return parsed.success ? [parsed.data] : [];
      });
      return {
        id: row.id, verificationId: row.verification_id,
        updatedAt: row.updated_at, messages: messages.slice(-40),
      };
    });
    return Response.json({ conversations }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    const { status, message } = publicError(error);
    return Response.json({ error: message }, { status });
  }
}
