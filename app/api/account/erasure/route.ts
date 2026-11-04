// Parcours RGPD non destructif : dépôt, statut et annulation d'une demande.
// Aucun accès aux objets Storage, auth.admin.deleteUser, Stripe ni OpenAI.
import { requireUser, publicError, HttpError } from '@/lib/security/auth';
import { isSameOrigin } from '@/lib/security/origin';
import { createAdminSupabase } from '@/lib/supabase/admin';
import {
  erasureActionSchema, erasureStatusSchema,
  ACTIVE_ERASURE_STATUSES, canCancelErasure, requiresErasureCooldown,
} from '@/lib/privacy/erasure';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RequestRow = {
  id: string;
  status: string;
  requested_at: string;
  updated_at: string;
  cancelled_at: string | null;
};
const safeFields = 'id,status,requested_at,updated_at,cancelled_at';

export async function GET() {
  try {
    const { client } = await requireUser();
    const { data, error } = await client.from('privacy_erasure_requests')
      .select(safeFields).order('requested_at',{ascending:false}).limit(1).maybeSingle();
    if (error) throw new Error('Erreur de consultation de la demande RGPD.');
    return Response.json({ request: data ?? null }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    const { status, message } = publicError(error);
    return Response.json({ error: message }, { status, headers: { 'Cache-Control':'no-store' } });
  }
}

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) throw new HttpError(403,'Origine interdite.');
    const { user } = await requireUser();
    let body: unknown;
    try { body = await request.json(); }
    catch { throw new HttpError(400,'JSON invalide.'); }
    const input = erasureActionSchema.safeParse(body);
    if (!input.success) throw new HttpError(422,'Demande invalide.');

    const admin = createAdminSupabase();
    const latest = async (): Promise<RequestRow | null> => {
      const { data, error } = await admin.from('privacy_erasure_requests')
        .select(safeFields).eq('user_id', user.id)
        .order('requested_at',{ascending:false}).limit(1).maybeSingle();
      if(error) throw new Error('Impossible de consulter les demandes.');
      return data as RequestRow | null;
    };
    const recent = await latest();
    const parsedStatus = recent ? erasureStatusSchema.safeParse(recent.status) : null;
    if (recent && !parsedStatus?.success)
      throw new Error('État de la demande incohérent.');

    if (input.data.action === 'request') {
      if (recent && parsedStatus?.success &&
        ACTIVE_ERASURE_STATUSES.has(parsedStatus.data)) {
        return Response.json({ request: recent, alreadyActive: true }, {
          headers: { 'Cache-Control':'private, no-store' },
        });
      }
      if (recent && parsedStatus?.success &&
          requiresErasureCooldown(parsedStatus.data,
            recent.cancelled_at ?? recent.updated_at)) {
        throw new HttpError(429,'Attends une minute après l’annulation avant une nouvelle demande.');
      }
      if (parsedStatus?.success && parsedStatus.data === 'completed')
        throw new HttpError(409,'Cette demande a déjà été traitée.');
      const { data, error } = await admin.from('privacy_erasure_requests')
        .insert({ user_id:user.id, status:'requested' })
        .select(safeFields).single();
      if (error || !data) {
        // Unique index protège deux demandes simultanées du même utilisateur.
        const concurrent = await latest();
        if (concurrent && erasureStatusSchema.safeParse(concurrent.status).success &&
            (concurrent.status === 'requested' || concurrent.status === 'reviewing')) {
          return Response.json({request:concurrent, alreadyActive:true},{
            headers:{ 'Cache-Control':'private, no-store' },
          });
        }
        throw new Error('Création de la demande impossible.');
      }
      return Response.json({request:data,created:true},{
        status:202,headers:{'Cache-Control':'private, no-store'},
      });
    }
    if (!recent || !parsedStatus?.success || !canCancelErasure(parsedStatus.data))
      throw new HttpError(409,'Seule une demande en attente peut être annulée.');
    const { data: cancelled, error } = await admin.from('privacy_erasure_requests')
      .update({status:'cancelled',cancelled_at:new Date().toISOString(),
        updated_at:new Date().toISOString()})
      .eq('id', recent.id).eq('user_id',user.id).eq('status','requested')
      .select(safeFields).maybeSingle();
    if(error || !cancelled)
      throw new HttpError(409,'La demande est déjà prise en charge ou a changé d’état.');
    return Response.json({request:cancelled},{
      headers:{'Cache-Control':'private, no-store'},
    });
  } catch(error) {
    const { status, message } = publicError(error);
    return Response.json({error:message},{
      status,headers:{'Cache-Control':'no-store'},
    });
  }
}
