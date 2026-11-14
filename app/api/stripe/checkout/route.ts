// Un checkout de TEST seulement, impossible sans activation explicite.
import { z } from 'zod';
import { requireUser, HttpError, publicError } from '@/lib/security/auth';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { billingGate, paidPriceId } from '@/lib/billing/config';
import { getStripe } from '@/lib/billing/stripe';
import { isVerifiedFrenchProfessionalBuyer } from '@/lib/billing/business-eligibility';

export const runtime = 'nodejs';
const schema = z.object({ plan: z.enum(['solo','pro','studio']) }).strict();
export async function POST(request: Request) {
  try {
    const gate = billingGate(process.env);
    if (!gate.enabled) throw new HttpError(503, gate.reason);
    const requestOrigin = new URL(request.url).origin;
    if (request.headers.get('origin') !== requestOrigin ||
        (gate.mode === 'live' && requestOrigin !== process.env.NEXT_PUBLIC_APP_URL))
      throw new HttpError(403, 'Origine non autorisée.');
    // Sans dispositif de médiation B2C conventionné, une vente Live ne peut
    // concerner que des entreprises françaises vérifiées, sur opt-in explicite.
    // Ce contrôle est distinct de la validation fiscale/CGV/E2E de billingGate.
    if (gate.mode === 'live' &&
        process.env.STRIPE_LIVE_BUYER_SCOPE !== 'verified_b2b_fr') {
      throw new HttpError(503, 'Le Checkout Live est réservé aux professionnels vérifiés.');
    }
    const { user } = await requireUser();
    // Supabase auth.getUser() fournit des app_metadata administrées côté
    // serveur. Ne jamais accepter une simple case ou un user_metadata client.
    if (gate.mode === 'live' &&
        !isVerifiedFrenchProfessionalBuyer(user.app_metadata)) {
      throw new HttpError(403, 'Souscription réservée aux professionnels vérifiés.');
    }
    let body: unknown;
    try { body = await request.json(); }
    catch { throw new HttpError(400, 'JSON incorrect.'); }
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new HttpError(422, 'Offre inconnue.');
    // Valider le prix avant toute création de client ou session fournisseur.
    const price = paidPriceId(parsed.data.plan, gate);
    const admin = createAdminSupabase();
    // Refuser une seconde souscription tant que la précédente existe.
    // Les modifications d'offre passent par le portail Stripe.
    const { data: existing, error: subscriptionError } = await admin.from('subscriptions')
      .select('stripe_subscription_id,status').eq('user_id', user.id).maybeSingle();
    if (subscriptionError) throw new Error('Subscription lookup unavailable.');
    if (existing?.stripe_subscription_id &&
        existing.status !== 'canceled' && existing.status !== 'incomplete_expired') {
      throw new HttpError(409, 'Un abonnement existe déjà. Modifiez votre offre depuis la facturation.');
    }
    const { data: profile, error } = await admin.from('users')
      .select('stripe_customer_id').eq('id', user.id).single();
    if (error || !profile || !user.email) throw new Error('Compte inaccessible.');
    const stripe = getStripe();
    // Vérifier la tarification directement dans Stripe lors du lancement live.
    // Le montant final ne dépend jamais d'une donnée envoyée par le navigateur.
    if (gate.mode === 'live') {
      const priceDetails = await stripe.prices.retrieve(price);
      const expected = {solo:900,pro:1900,studio:4900}[parsed.data.plan];
      if (!priceDetails.livemode || !priceDetails.active ||
          priceDetails.currency !== 'eur' || priceDetails.unit_amount !== expected ||
          priceDetails.recurring?.interval !== 'month' ||
          priceDetails.tax_behavior !== 'inclusive') {
        throw new HttpError(503,'Prix Stripe incompatible avec les offres publiées.');
      }
    }
    let customerId: string | undefined = profile.stripe_customer_id ?? undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email },
        { idempotencyKey: 'mentioncheck_customer_'+user.id });
      customerId = customer.id;
      const { error: savedError } = await admin.from('users')
        .update({ stripe_customer_id: customerId }).eq('id', user.id);
      if (savedError) throw new Error('Impossible de rattacher le client de test.');
    }
    // Le webhook peut arriver après le paiement : vérifier aussi l'état fournisseur,
    // et non uniquement la projection locale des droits.
    const liveSubscriptions = await stripe.subscriptions.list({
      customer: customerId, status: 'all', limit: 100,
    });
    if (liveSubscriptions.data.some(item =>
      item.status !== 'canceled' && item.status !== 'incomplete_expired')) {
      throw new HttpError(409, 'Un abonnement Stripe existe déjà. Utilisez le portail de facturation.');
    }
    // Une session ouverte peut être payée plus tard : ne pas en créer une seconde.
    const openSessions = await stripe.checkout.sessions.list({
      customer: customerId, status: 'open', limit: 100,
    });
    if (openSessions.data.some(item => item.mode === 'subscription')) {
      throw new HttpError(409, 'Une souscription est déjà en cours. Terminez ou laissez expirer la session précédente.');
    }
    const base = new URL(request.url).origin;
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price, quantity:1 }],
      success_url: base + '/dashboard/settings?checkout=return',
      cancel_url: base + '/tarifs?checkout=cancel',
      metadata: { user_id: user.id, selected_plan: parsed.data.plan },
      subscription_data: { metadata: { user_id: user.id, plan: parsed.data.plan } },
      ...(gate.mode==='live' ? {consent_collection:{terms_of_service:'required' as const}} : {}),
    }, {idempotencyKey:'mentioncheck_checkout_'+user.id+'_'+Math.floor(Date.now()/600000)});
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
