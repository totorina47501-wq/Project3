import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import MentionsLegalesPage, { metadata } from '../../app/legal/mentions-legales/page';
import { BRAND } from '../../lib/branding';

describe('Branding légal public', () => {
  it('aligne le nom légal déclaré et le domaine canonique', () => {
    expect(BRAND.legalName).toBe('MentionCheckCorp');
    expect(BRAND.domain).toBe('mentioncheck.app');
  });

  it('conserve la page légale en brouillon non indexable avec canonical exact', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.alternates?.canonical).toBe('/legal/mentions-legales');
  });

  it('n expose pas de fausses mentions légales', () => {
    const html = renderToStaticMarkup(createElement(MentionsLegalesPage));
    expect(html).toContain('MentionCheckCorp');
    expect(html).toContain('déclaration non encore vérifiée');
    expect(html).toContain('Domaine canonique déclaré : mentioncheck.app');
    expect(html).toContain('à confirmer avec justificatifs');
    expect(html).not.toContain('MentionCheckIA');
    expect(html).not.toContain('mentioncheck.fr');
    expect(html).not.toMatch(/\b\d{9}\b/);
  });
});
