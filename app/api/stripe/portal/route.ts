// Portail de facturation Stripe test, accessible uniquement à l'utilisateur lié.
import { requireUser, HttpError, publicError } from '@/lib/security/auth';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { billingGate } from '@/lib/billing/config';
import { getStripe } from '@/lib/billing/stripe';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const gate=billingGate(process.env);
    if (!gate.enabled) throw new HttpError(503, gate.reason);
    const requestOrigin = new URL(request.url).origin;
    if (request.headers.get('origin') !== requestOrigin ||
        (gate.mode === 'live' && requestOrigin !== process.env.NEXT_PUBLIC_APP_URL))
      throw new HttpError(403, 'Origine non autorisée.');
    const { user } = await requireUser();
    const { data, error } = await createAdminSupabase().from('users')
      .select('stripe_customer_id').eq('id', user.id).single();
    if (error || !data?.stripe_customer_id)
      throw new HttpError(404, 'Aucun compte de facturation associé.');
    const portal = await getStripe().billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: new URL(request.url).origin + '/dashboard/settings',
    });
    return Response.json({ url:portal.url }, {
      headers:{'Cache-Control':'no-store'},
    });
  } catch (error) {
    const { status, message } = publicError(error);
    return Response.json({ error:message }, { status,
      headers:{'Cache-Control':'no-store'} });
  }
}
