import { describe,expect,it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BillingPortal } from '../../components/BillingPortal';

describe('Portail client sécurisé',()=>{
  it('permet de consulter factures et résiliation en mode test',()=>{
    const markup=renderToStaticMarkup(createElement(BillingPortal,{mode:'test'}));
    expect(markup).toContain('Gérer mon abonnement et mes factures');
    expect(markup).toContain('paiements simulés uniquement');
  });
  it('ne présente pas de message Sandbox dans un futur mode live autorisé',()=>{
    const markup=renderToStaticMarkup(createElement(BillingPortal,{mode:'live'}));
    expect(markup).not.toContain('paiements simulés uniquement');
  });
});
