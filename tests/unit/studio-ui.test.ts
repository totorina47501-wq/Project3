import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StudioPanel } from '../../components/StudioPanel';
describe('Studio écran initial accessible', () => {
  it('explique avant saisie le partage, les limites de sièges et les invitations locales', () => {
    const html = renderToStaticMarkup(createElement(StudioPanel));
    expect(html).toContain('L’historique personnel reste privé');
    expect(html).toContain('cinq sièges');
    expect(html).toContain('email vérifié');
    expect(html).toContain('Cette action ne modifie aucun abonnement');
    expect(html).toContain('type="password"');
    expect(html).toContain('autoComplete="off"');
    expect(html).not.toContain('mc_studio_');
  });
});
