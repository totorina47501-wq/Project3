import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import MentionsLegalesPage, { metadata } from '../../app/legal/mentions-legales/page';
import { BRAND } from '../../lib/branding';

describe('Branding légal public', () => {
  it('aligne le nom légal déclaré et le domaine canonique', () => {
    expect(BRAND.legalName).toBe('Ali Rassoul');
    expect(BRAND.tradeName).toBe('Aliaicorp');
    expect(BRAND.siret).toBe('899 123 459 00013');
    expect(BRAND.domain).toBe('mentioncheck.app');
  });

  it('publie les mentions légales avec le canonical exact', () => {
    expect(metadata.robots).toBeUndefined();
    expect(metadata.alternates?.canonical).toBe('/legal/mentions-legales');
  });

  it('n expose pas de fausses mentions légales', () => {
    const html = renderToStaticMarkup(createElement(MentionsLegalesPage));
    expect(html).toContain('Ali Rassoul');
    expect(html).toContain('899 123 459 00013');
    expect(html).toContain('Aliaicorp');
    expect(html).toContain('4, rue de la Boule');
    expect(html).toContain('contact@aliaicorp.fr');
    expect(html).toContain('0675814948');
    expect(html).toContain('293 B du CGI');
    expect(html).toContain('Cloudflare, Inc.');
    expect(html).toContain('Supabase');
    expect(html).not.toContain('93214476900019');
    expect(html).not.toContain('MentionCheckIA');
    expect(html).not.toContain('mentioncheck.fr');
    expect(html).not.toContain('MentionCheckCorp');
  });
});
