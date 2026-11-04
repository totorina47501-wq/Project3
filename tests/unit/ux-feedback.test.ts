import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AIStreamProgress } from '../../components/AIStreamProgress';
import { AIRewriteDiff } from '../../components/AIRewriteDiff';

describe('Retours accessibles de la vérification', () => {
  it('ne présente pas un contrôle terminé comme une analyse en cours', () => {
    const html = renderToStaticMarkup(createElement(AIStreamProgress, {
      stages: { scan_text: 'complete', scoring: 'complete' },
    }));
    expect(html).toContain('Étapes du contrôle');
    expect(html).not.toContain('Mia analyse ta publication');
  });

  it('donne un nom accessible au texte de la réécriture', () => {
    const html = renderToStaticMarkup(createElement(AIRewriteDiff, {
      verificationId: 'verification-test',
      rewrite: { rewrittenCaption: 'Publicité — Un exemple.', changes: [], confidence: 0.8 },
    }));
    expect(html).toContain('aria-label="Texte proposé par Mia"');
  });
});
