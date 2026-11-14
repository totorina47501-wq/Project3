import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Terms, { metadata as termsMetadata } from '../../app/legal/cgu/page';
import Confidentialite, { metadata as privacyMetadata } from '../../app/legal/confidentialite/page';

describe('Documents juridiques MentionCheck en prépublication', () => {
  it('garde les conditions d’abonnement non indexables et expose les droits consommateurs', () => {
    const html = renderToStaticMarkup(createElement(Terms));
    expect(termsMetadata.robots).toEqual({ index: false, follow: false });
    expect(termsMetadata.alternates?.canonical).toBeUndefined();
    expect(html).toContain('Conditions générales d’utilisation et de vente');
    expect(html).toContain('rétractation');
    expect(html).toContain('14 jours');
    expect(html).toContain('médiateur');
    expect(html).toContain('Solo (9 € par mois)');
    expect(html).toContain('TVA non applicable, art. 293 B du CGI');
    expect(html).toContain('Les abonnements Solo, Pro et Studio sont mensuels et reconduits automatiquement');
    expect(html).toContain('depuis son compte, rubrique Paramètres');
    expect(html).toContain('quatorze jours après la notification');
    expect(html).toContain('Une confirmation durable de la commande et des conditions doit être transmise au client.');
    expect(html).toContain('la seule existence d&#x27;un webhook ne vaut pas preuve de remise de cette confirmation.');
    expect(html).toContain('Aucune renonciation automatique au droit de rétractation n&#x27;est imposée.');
    expect(html).toContain('aucun médiateur effectivement conventionné');
    expect(html).toContain('avant toute vente aux consommateurs');
    expect(html).toContain('situé hors de France');
    expect(html).not.toContain('mentioncheckcorp@gmail.com');
    expect(html).toContain('non encore approuvé');
    expect(html).toContain('Ali Rassoul');
    expect(html).toContain('contact@aliaicorp.fr');
    expect(html).not.toContain('MentionsCheckIA');
    expect(html).not.toMatch(/\b\d{9}\b/);
  });

  it('informe sur les droits RGPD et refuse toute promesse de purge complète', () => {
    const html = renderToStaticMarkup(createElement(Confidentialite));
    expect(privacyMetadata.robots).toEqual({ index: false, follow: false });
    expect(privacyMetadata.alternates?.canonical).toBeUndefined();
    expect(html).toContain('Politique de confidentialité et cookies');
    expect(html).toContain('opposition');
    expect(html).toContain('Consentement');
    expect(html).toContain('CNIL');
    expect(html).toContain('pas encore certifiée');
    expect(html).toContain('prépublication');
    expect(html).toContain('Ali Rassoul');
    expect(html).toContain('contact@aliaicorp.fr');
    expect(html).toContain('180 jours');
    expect(html).toContain('GTM-P83X0PBJ');
    expect(html).toContain('G-JKXWT2NBWT');
    expect(html).toContain('deux ans');
    expect(html).toContain('transferts de données');
  });
});
