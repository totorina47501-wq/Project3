import { describe, expect, it } from 'vitest';
import { assessCommercialReadiness, type CommercialReadinessInput } from '../../lib/billing/readiness';

// Coordonnées et références strictement fictives : ces fixtures ne sont jamais publiées.
const complete: CommercialReadinessInput = {
  environment: {
    NEXT_PUBLIC_APP_URL: 'https://local.test',
    BILLING_ENABLED: 'false', STRIPE_MODE: 'test',
    STRIPE_SECRET_KEY: 'sk_test_private_fixture', STRIPE_WEBHOOK_SECRET: 'whsec_private_fixture',
    STRIPE_PRICE_SOLO: 'price_SOLO', STRIPE_PRICE_PRO: 'price_PRO', STRIPE_PRICE_STUDIO: 'price_STUDIO',
  },
  publisher: {
    legalName: 'Éditeur de test', legalForm: 'SAS de test', registeredOffice: 'Adresse fictive de test',
    registration: 'Immatriculation fictive', contactEmail: 'editeur@local.test', publicationDirector: 'Responsable de test',
  },
  terms: {
    version: 'version-contractuelle-test', taxDisplay: 'ttc', cancellationPolicy: 'Résiliation de test',
    withdrawalPolicy: 'Rétractation de test', disputeResolution: 'Médiation de test',
  },
  privacy: {
    version: 'version-rgpd-test', contactEmail: 'donnees@local.test', retentionSchedule: 'Matrice de test',
    erasureProcedure: 'Procédure de test', processingRegister: 'Registre de test',
  },
  reviews: {
    legal: 'revue-legale-test', cloudflareDpa: 'dpa-cf-test', supabaseDpa: 'dpa-supabase-test',
    openaiDpa: 'dpa-openai-test', transfers: 'transferts-test', billingSandbox: 'recu-stripe-test',
  },
};

describe('Préparation commerciale sans activation ni divulgation', () => {
  it('énumère les champs précis manquants au lieu de déduire une identité de la marque', () => {
    const result = assessCommercialReadiness();
    expect(result.readyForReview).toBe(false);
    expect(result.canOpenCommercial).toBe(false);
    expect(result.checks.filter(check => check.status === 'missing').map(check => check.field)).toEqual(expect.arrayContaining([
      'publisher.legalName', 'publisher.registration', 'publisher.publicationDirector',
      'terms.taxDisplay', 'privacy.retentionSchedule', 'reviews.openaiDpa',
      'environment.STRIPE_PRICE_SOLO', 'environment.NEXT_PUBLIC_APP_URL',
    ]));
    expect(result.capabilities).toEqual({ billing: 'disabled', email: 'preview-only', socialAccounts: 'manual-only' });
  });

  it('accepte un dossier complet pour revue tout en conservant les paiements désactivés', () => {
    const before = structuredClone(complete);
    const result = assessCommercialReadiness(complete);
    expect(result.readyForReview).toBe(true);
    expect(result.checks.every(check => check.status === 'present')).toBe(true);
    expect(result.canOpenCommercial).toBe(false);
    expect(result.capabilities.billing).toBe('disabled');
    expect(result.blockers.map(blocker => blocker.code)).toEqual(expect.arrayContaining([
      'BILLING_LIVE_NOT_APPROVED', 'BILLING_CARD_PAYMENT_TEST_MISSING', 'PERSONAL_DATA_ERASURE_REVIEW',
    ]));
    expect(complete).toEqual(before);
    expect(assessCommercialReadiness(complete)).toEqual(result);
    const serialized = JSON.stringify(result);
    for (const value of ['sk_test_private_fixture', 'whsec_private_fixture', 'editeur@local.test', 'Adresse fictive de test'])
      expect(serialized).not.toContain(value);
  });

  it('refuse les substituts, origines non HTTPS et configurations Stripe ambiguës ou live', () => {
    const result = assessCommercialReadiness({
      ...complete,
      publisher: { ...complete.publisher, legalName: 'À compléter', contactEmail: 'pas-un-email' },
      environment: { ...complete.environment, NEXT_PUBLIC_APP_URL: 'https://local.test/path', STRIPE_PRICE_SOLO: 'price_PRO', STRIPE_MODE: 'live', STRIPE_SECRET_KEY: 'sk_live_private_fixture' },
    });
    expect(result.readyForReview).toBe(false);
    const states = Object.fromEntries(result.checks.map(check => [check.field, check.status]));
    expect(states).toMatchObject({
      'publisher.legalName': 'invalid', 'publisher.contactEmail': 'invalid',
      'environment.NEXT_PUBLIC_APP_URL': 'invalid', 'environment.STRIPE_PRICE_SOLO': 'invalid',
      'environment.STRIPE_PRICE_PRO': 'invalid', 'environment.STRIPE_MODE': 'invalid',
      'environment.STRIPE_SECRET_KEY': 'invalid',
    });
    expect(JSON.stringify(result)).not.toContain('sk_live_private_fixture');
  });

  it('ne prend ni une configuration de clés ni un flag de test pour une autorisation commerciale', () => {
    const result = assessCommercialReadiness({ ...complete, environment: { ...complete.environment, BILLING_ENABLED: 'true' } });
    expect(result.capabilities.billing).toBe('test-only');
    expect(result.canOpenCommercial).toBe(false);
    expect(result.blockers.some(blocker => blocker.code === 'EMAIL_DELIVERY_UNIMPLEMENTED')).toBe(true);
  });
});
