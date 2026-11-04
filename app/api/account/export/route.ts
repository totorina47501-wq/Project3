// Export RGPD personnel : données lisibles par le propriétaire, jamais par service_role.
import { requireUser, publicError } from '@/lib/security/auth';
import { isExportTruncated } from '@/lib/privacy/export';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LIMIT = 1000;
export async function GET() {
  try {
    const { user, client } = await requireUser();
    const [profile, verifications, conversations, deals, subscriptions, social, usage, feedback, media, metrics] =
      await Promise.all([
        client.from('users').select('id,email,plan,ai_training_opt_in,created_at,updated_at')
          .eq('id',user.id).single(),
        client.from('verifications').select('*', { count: 'exact' }).order('created_at',{ascending:false}).range(0,LIMIT - 1),
        client.from('assistant_conversations').select('id,verification_id,messages,created_at,updated_at', { count: 'exact' })
          .order('created_at',{ascending:false}).range(0,LIMIT - 1),
        client.from('brand_deals').select('id,brand_name,start_date,end_date,contract_url,archived_at,hash_sha256,created_at', { count: 'exact' })
          .order('created_at',{ascending:false}).range(0,LIMIT - 1),
        client.from('subscriptions').select('id,plan,status,current_period_end,created_at,updated_at', { count: 'exact' })
          .range(0,LIMIT - 1),
        client.from('social_accounts').select('id,platform,handle,connected_at', { count: 'exact' }).range(0,LIMIT - 1),
        client.from('usage_monthly').select('period_start,checks_used,rewrites_used,mia_messages_used', { count: 'exact' })
          .order('period_start',{ascending:false}).range(0,LIMIT - 1),
        client.from('rewrite_feedback').select('id,verification_id,accepted_at', { count: 'exact' }).range(0,LIMIT - 1),
        client.from('media_assets').select('id,kind,status,mime_type,declared_bytes,actual_bytes,duration_seconds,created_at,expires_at', { count: 'exact' })
          .range(0,LIMIT - 1),
        client.from('ai_analyses').select('id,verification_id,stage,model_used,prompt_tokens,completion_tokens,latency_ms,cost_usd,created_at', { count: 'exact' })
          .range(0,LIMIT - 1),
      ]);
    const lists = { verifications, conversations, deals, subscriptions, social, usage, feedback, media, metrics };
    if (profile.error || !profile.data ||
      Object.values(lists).some((item) => item.error))
      throw new Error('Impossible de récupérer toutes les données personnelles.');

    const collections = Object.fromEntries(Object.entries(lists).map(([name,result]) =>
      [name, (result.data ?? []).slice(0,LIMIT)]));
    const truncated = Object.fromEntries(Object.entries(lists).map(([name,result]) =>
      [name, isExportTruncated(result.count, (result.data ?? []).length, LIMIT)]));
    const hasTruncation = Object.values(truncated).some(Boolean);
    const payload = {
      schemaVersion: '2026-11-04', exportedAt: new Date().toISOString(),
      profile: profile.data, collections,
      information: {
        limitPerCollection: LIMIT,
        truncated, structuredDataComplete: !hasTruncation, isComplete: false,
        note: 'L\'export est partiel par conception : les octets des fichiers Storage et données des prestataires externes ne sont pas inclus. Pour un export complet des fichiers ou des collections tronquées, demander une extraction complémentaire.',
      },
    };
    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="mentioncheck-mes-donnees.json"',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    const { status, message } = publicError(error);
    return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
