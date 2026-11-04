// Strictement serveur : aucune clé Stripe côté navigateur.
import 'server-only';
import Stripe from 'stripe';
import { billingGate } from '@/lib/billing/config';

export function getStripe() {
  const gate = billingGate(process.env);
  if (!gate.enabled || !process.env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe test non activé.');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    maxNetworkRetries: 2, timeout: 10000,
  });
}
