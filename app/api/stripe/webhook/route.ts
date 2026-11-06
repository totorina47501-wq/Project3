// Webhook Stripe : uniquement tests signés, idempotence, rattachement client vérifié.
// Ne jamais croire un user_id fourni en metadata comme autorisation.
import type Stripe from 'stripe';
import { billingGate } from '@/lib/billing/config';
import { getStripe } from '@/lib/billing/stripe';
import { paidPlanFromPrices, stripeStatus, subscriptionPeriodEnd } from '@/lib/billing/events';
import { createAdminSupabase } from '@/lib/supabase/admin';

export const runtime='nodejs';

async function syncSubscription(subscription: Stripe.Subscription, eventAt:number, deleted = false) {
  const gate=billingGate(process.env);
  const plan=paidPlanFromPrices(subscription.items.data.map(item=>item.price.id),{
    solo:gate.priceSolo,pro:gate.pricePro,studio:gate.priceStudio,
  });
  if(!plan) throw new Error('Unexpected Stripe plan price.');
  const {error}=await createAdminSupabase().rpc('sync_stripe_subscription',{
    p_customer:typeof subscription.customer==='string'?subscription.customer:subscription.customer.id,
    p_subscription:subscription.id,p_created:new Date(subscription.created*1000).toISOString(),
    p_event_at:new Date(eventAt*1000).toISOString(),p_plan:plan,
    p_status:deleted?'canceled':stripeStatus(subscription.status),
    p_period_end:subscriptionPeriodEnd(subscription),
  });
  if(error) throw new Error('Atomic subscription sync unavailable.');
}

async function handleEvent(event: Stripe.Event) {
  if (event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated') {
    const source = event.data.object as Stripe.Subscription;
    // Relecture de l'état actuel pour éviter qu'un ancien événement rétrograde l'abonnement.
    const current = await getStripe().subscriptions.retrieve(source.id);
    await syncSubscription(current,event.created);
  } else if (event.type === 'customer.subscription.deleted') {
    const deleted = event.data.object as Stripe.Subscription;
    await syncSubscription(deleted,event.created,true);
  }
  // checkout.session.completed seul n'active jamais un plan :
  // attendre une notification subscription vérifiée.
}

export async function POST(request: Request) {
  const gate = billingGate(process.env);
  if (!gate.enabled || !process.env.STRIPE_WEBHOOK_SECRET)
    return Response.json({error:'Stripe désactivé.'},{status:503});
  const signature = request.headers.get('stripe-signature');
  if (!signature) return Response.json({error:'Signature manquante.'},{status:400});
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      await request.text(),signature,process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return Response.json({error:'Signature invalide.'},{status:400});
  }
  if (event.livemode) return Response.json({error:'Événement Stripe de production refusé.'},{status:400});
  const admin = createAdminSupabase();
  const { data: existing, error: existingError } = await admin.from('stripe_webhook_events')
    .select('status').eq('event_id',event.id).maybeSingle();
  if (existingError) return Response.json({error:'Service indisponible.'},{status:503});
  if (existing?.status === 'processed') return Response.json({received:true},{status:200});
  if (existing?.status === 'processing') {
    // Ne pas considérer un webhook concurrent comme traité : Stripe réessaiera.
    return Response.json({error:'Traitement en cours.'},{status:503});
  }
  if (!existing) {
    const { error } = await admin.from('stripe_webhook_events').insert({
      event_id:event.id,event_type:event.type,status:'processing',
    });
    if (error) return Response.json({error:'Service indisponible.'},{status:503});
  } else {
    const { error } = await admin.from('stripe_webhook_events')
      .update({status:'processing'}).eq('event_id',event.id).eq('status','failed');
    if (error) return Response.json({error:'Service indisponible.'},{status:503});
  }
  try {
    await handleEvent(event);
    const { error } = await admin.from('stripe_webhook_events')
      .update({status:'processed',processed_at:new Date().toISOString()})
      .eq('event_id',event.id);
    if (error) throw new Error('Webhook acknowledgement unavailable.');
    return Response.json({received:true},{status:200});
  } catch {
    await admin.from('stripe_webhook_events')
      .update({status:'failed'}).eq('event_id',event.id);
    return Response.json({error:'Traitement non terminé.'},{status:503});
  }
}
