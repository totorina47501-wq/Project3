// Les tests Vitest n'ont jamais le droit d'appeler OpenAI, Supabase ou Stripe.
import { beforeEach, afterEach, vi } from 'vitest';
beforeEach(() => {
  vi.stubGlobal('fetch', () => {
    throw new Error('Réseau désactivé pendant les tests unitaires (zéro crédit IA).');
  });
});
afterEach(() => vi.unstubAllGlobals());
