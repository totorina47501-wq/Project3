import { describe, expect, it } from 'vitest';
import { isVerifiedFrenchProfessionalBuyer } from '../../lib/billing/business-eligibility';

const fixedNow = Date.parse('2026-11-14T17:00:00Z');
const verified = {
  mentioncheck_b2b: {
    verified: true,
    country: 'FR',
    purchase_purpose: 'core_professional_activity',
    reviewed_by: 'operator',
    legal_name: 'Professionnel Test SAS',
    registration_id: '123456789',
    reviewed_at: '2026-11-13T13:00:00Z',
  },
};

describe('Eligibilité B2B au Checkout Live — refus par défaut', () => {
  it('rejette les comptes inconnus ou les données contrôlables par le client', () => {
    for (const payload of [null, undefined, {}, [], { user_metadata: verified }, { mentioncheck_b2b: 'verified' }])
      expect(isVerifiedFrenchProfessionalBuyer(payload, fixedNow)).toBe(false);
  });
  it('accepte seulement un dossier français revu par l’opérateur pour l’activité principale', () => {
    expect(isVerifiedFrenchProfessionalBuyer(verified, fixedNow)).toBe(true);
    expect(isVerifiedFrenchProfessionalBuyer({
      mentioncheck_b2b: { ...verified.mentioncheck_b2b, registration_id: '12345678900017' },
    }, fixedNow)).toBe(true);
  });
  it('refuse les ventes B2C et les simples déclarations professionnelles', () => {
    for (const patch of [
      {verified: false}, {verified: 'true'}, {country: 'BE'},
      {purchase_purpose: 'personal'}, {purchase_purpose: 'incidental_activity'},
      {reviewed_by: 'self'}, {legal_name: ''},
      {registration_id: 'unknown'}, {reviewed_at: 'not-a-date'},
      {reviewed_at: '2026-11-15T12:00:00Z'}, {reviewed_at: '2026-07-01T12:00:00Z'},
    ]) expect(isVerifiedFrenchProfessionalBuyer({
      mentioncheck_b2b: { ...verified.mentioncheck_b2b, ...patch },
    }, fixedNow)).toBe(false);
  });
});
