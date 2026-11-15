import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe,expect,it } from 'vitest';
import { BrandDeals } from '../../components/BrandDeals';

describe('Parcours créateur et media kit',()=>{
  it('présente un parcours clavier, local et sans statistiques inventées',()=>{
    const markup=renderToStaticMarkup(createElement(BrandDeals));
    for(const text of [
      'Ma première collaboration',
      'Activité ou niche',
      'Budget déclaré par toi',
      'Générer un modèle déterministe',
      'aucun message n’est envoyé',
      'Extrait facultatif (12 000 caractères maximum)',
      'Aucune statistique, audience, portée, performance',
      'Inclure',
      'Télécharger mon media kit PDF',
    ])expect(markup).toContain(text);
    expect(markup).toContain('maxLength="12000"');
    expect(markup).not.toContain('followers');
    expect(markup).not.toContain('impressions');
  });
});
