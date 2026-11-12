import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SocialAccounts } from '../../components/SocialAccounts';
import { AIPreferences } from '../../components/AIPreferences';
describe('Paramètres rendus sans fournisseur',()=>{
  it('affiche une déclaration sans prétendre à une connexion et bloque visuellement le quatrième Solo',()=>{
    const html=renderToStaticMarkup(createElement(SocialAccounts,{plan:'solo',initialTotal:3,initialItems:[{id:'local',platform:'instagram',handle:'camille',connection_kind:'manual',connected_at:'2026-11-04'}]}));
    expect(html).toContain('aucune connexion OAuth');expect(html).toContain('Plan Solo : 3 comptes maximum');
    expect(html).toContain('Connexion indisponible');expect(html).not.toContain('Connecter Instagram');
    expect(html).toMatch(/<button disabled=""[^>]*>Ajouter la déclaration<\/button>/);
    expect(html).toContain('Retirer la déclaration @camille');
  });
  it('compte uniquement les connexions OAuth enregistrées, et non les déclarations manuelles ou expirées',()=>{
    const html=renderToStaticMarkup(createElement(SocialAccounts,{
      plan:'solo',initialTotal:3,initialConnectedTotal:1,
      initialItems:[
        {id:'oauth',platform:'youtube',handle:'channel',connection_kind:'oauth',connected_at:'2026-11-04'},
        {id:'manual',platform:'instagram',handle:'creator',connection_kind:'manual',connected_at:'2026-11-04'},
        {id:'expired',platform:'tiktok',handle:'old',connection_kind:'expired',connected_at:'2026-11-04'},
      ],
    }));
    expect(html).toContain('Comptes reliés : <!-- -->1');
    expect(html).toContain('Autres comptes enregistrés : <!-- -->2');
    expect(html).toContain('Connexion OAuth active');
    expect(html).toContain('Déconnecter');
    expect(html).toMatch(/<button disabled=""[^>]*>Ajouter la déclaration<\/button>/);
  });
  it('identifie une connexion expirée sans la présenter comme OAuth active',()=>{
    const html=renderToStaticMarkup(createElement(SocialAccounts,{plan:'pro',initialTotal:1,initialItems:[{id:'expired',platform:'youtube',handle:'channel',connection_kind:'expired',connected_at:'2026-11-04'}]}));
    expect(html).toContain('Connexion expirée ou déconnectée');
    expect(html).not.toContain('Déconnecter');
    expect(html).toContain('Retirer la déclaration @channel');
  });
  it('conserve les comptes historiques en lecture seule',()=>{
    const html=renderToStaticMarkup(createElement(SocialAccounts,{plan:'pro',initialTotal:1,initialItems:[{id:'legacy',platform:'youtube',handle:'archive',connection_kind:'unknown',connected_at:'2026-11-04'}]}));
    expect(html).toContain('connexion non vérifiée');expect(html).not.toContain('Retirer la déclaration @archive');
  });
  it('montre la préférence persistée sans lancer une réécriture',()=>{
    const html=renderToStaticMarkup(createElement(AIPreferences,{initialTone:'institutionnel'}));
    expect(html).toContain('<option value="institutionnel" selected="">');
    expect(html).toContain('ne lance aucune analyse');
    expect(html).toMatch(/<button disabled=""[^>]*>Enregistrer le ton<\/button>/);
  });
});
