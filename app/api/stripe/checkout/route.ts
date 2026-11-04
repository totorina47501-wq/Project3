// Un checkout de TEST seulement, impossible sans activation explicite.
import { z } from 'zod';
import { requireUser, HttpError, publicError } from '@/lib/security/auth';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { billingGate, paidPriceId } from '@/lib/billing/config';
import { getStripe } from '@/lib/billing/stripe';

export const runtime = 'nodejs';
const schema = z.object({ plan: z.enum(['pro','studio']) }).strict();
export async function POST(request: Request) {
  try {
    const gate = billingGate(process.env);
    if (!gate.enabled) throw new HttpError(503, gate.reason);
    if (request.headers.get('origin') !== new URL(request.url).origin)
      throw new HttpError(403, 'Origine non autorisée.');
    const { user } = await requireUser();
    let body: unknown;
    try { body = await request.json(); }
    catch { throw new HttpError(400, 'JSON incorrect.'); }
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new HttpError(422, 'Offre inconnue.');
    const admin = createAdminSupabase();
    const { data: profile, error } = await admin.from('users')
      .select('stripe_customer_id').eq('id', user.id).single();
    if (error || !profile || !user.email) throw new Error('Compte inaccessible.');
    const stripe = getStripe();
    let customerId: string | undefined = profile.stripe_customer_id ?? undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email });
      customerId = customer.id;
      const { error: savedError } = await admin.from('users')
        .update({ stripe_customer_id: customerId }).eq('id', user.id);
      if (savedError) throw new Error('Impossible de rattacher le client de test.');
    }
    const base = new URL(request.url).origin;
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: paidPriceId(parsed.data.plan, gate), quantity:1 }],
      success_url: base + '/dashboard/settings?checkout=return',
      cancel_url: base + '/tarifs?checkout=cancel',
      metadata: { user_id: user.id, selected_plan: parsed.data.plan },
      subscription_data: { metadata: { user_id: user.id, plan: parsed.data.plan } },
    });
    if (!session.url) throw new Error('Session Stripe indisponible.');
    return Response.json({ url: session.url }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const { status, message } = publicError(error);
    return Response.json({ error: message }, { status,
      headers: { 'Cache-Control':'no-store' } });
  }
}
