import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Terms, { metadata as termsMetadata } from '../../app/legal/cgu/page';
import Confidentialite, { metadata as privacyMetadata } from '../../app/legal/confidentialite/page';

describe('Documents juridiques MentionCheck en prépublication', () => {
  it('garde les conditions d’abonnement non indexables et expose les droits consommateurs', () => {
    const html = renderToStaticMarkup(createElement(Terms));
    expect(termsMetadata.robots).toEqual({ index: false, follow: false });
    expect(termsMetadata.alternates?.canonical).toBe('/legal/cgu');
    expect(html).toContain('Conditions générales d’utilisation et de vente');
    expect(html).toContain('rétractation');
    expect(html).toContain('14 jours');
    expect(html).toContain('médiateur');
    expect(html).toContain('Solo (9 € par mois)');
    expect(html).toContain('non encore approuvé');
    expect(html).not.toContain('MentionsCheckIA');
    expect(html).not.toMatch(/\b\d{9}\b/);
  });

  it('informe sur les droits RGPD et refuse toute promesse de purge complète', () => {
    const html = renderToStaticMarkup(createElement(Confidentialite));
    expect(privacyMetadata.robots).toEqual({ index: false, follow: false });
    expect(privacyMetadata.alternates?.canonical).toBe('/legal/confidentialite');
    expect(html).toContain('Politique de confidentialité et cookies');
    expect(html).toContain('opposition');
    expect(html).toContain('Consentement');
    expect(html).toContain('CNIL');
    expect(html).toContain('pas encore certifiée');
    expect(html).toContain('prépublication');
  });
});
