import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SocialAccounts, socialOAuthFeedback } from '../../components/SocialAccounts';
import { AIPreferences } from '../../components/AIPreferences';
describe('Messages OAuth explicites et sûrs par réseau', () => {
  const feedback = (provider: string, stage: string, reason?: string) => socialOAuthFeedback(
    new URLSearchParams({
      social_oauth: 'unavailable',
      provider,
      social_oauth_error: stage,
      ...(reason ? { social_oauth_reason: reason } : {}),
    }),
  );
  it('explique une chaîne YouTube absente sans incrémenter de connexion', () => {
    expect(feedback('youtube', 'channel', 'no_channel')).toContain('Aucune chaîne YouTube trouvée');
    expect(feedback('youtube', 'channel', 'no_channel')).toContain('Crée d’abord une chaîne');
    expect(feedback('youtube', 'channel', 'quotaExceeded')).not.toContain('Aucune chaîne YouTube trouvée');
  });
  it.each(['instagram', 'tiktok', 'linkedin'] as const)(
    'différencie les erreurs de profil et de jeton pour %s',
    (provider) => {
      const noProfile = feedback(provider, 'channel', 'profile_unavailable');
      const token = feedback(provider, 'token');
      expect(noProfile).toContain(({ instagram: 'Instagram', tiktok: 'TikTok', linkedin: 'LinkedIn' })[provider]);
      expect(token).toContain(({ instagram: 'Instagram', tiktok: 'TikTok', linkedin: 'LinkedIn' })[provider]);
      expect(noProfile).not.toBe(token);
      expect(noProfile).not.toContain('Google refuse');
    },
  );
  it('couvre refus, stockage, succès et fournisseur inconnu', () => {
    expect(feedback('linkedin', 'storage')).toContain('enregistrement sécurisé');
    expect(feedback('instagram', 'authorization')).toContain('autorisation');
    expect(socialOAuthFeedback(new URLSearchParams('social_oauth=connected&provider=youtube'))).toContain('YouTube relié');
    expect(feedback('other', 'channel')).toContain('réseau social');
    expect(socialOAuthFeedback(new URLSearchParams())).toBe('');
    expect(feedback('youtube', 'token', 'invalid_client')).not.toContain('staging');
    expect(feedback('youtube', 'token')).not.toContain('staging');
  });
});

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
    expect(html).toContain('Comptes reliés : 1');
    expect(html).toContain('Autres comptes enregistrés : 2');
    expect(html).toContain('Connexion OAuth active');
    expect(html).toContain('Déconnecter');
    expect(html).toMatch(/<button disabled=""[^>]*>Ajouter la déclaration<\/button>/);
  });
  it('identifie une connexion expirée sans la présenter comme OAuth active',()=>{
    const html=renderToStaticMarkup(createElement(SocialAccounts,{plan:'pro',initialTotal:1,initialItems:[{id:'expired',platform:'youtube',handle:'channel',connection_kind:'expired',connected_at:'2026-11-04'}]}));
    expect(html).toContain('Connexion expirée ou déconnectée');
    expect(html).toContain('reconnecte le compte pour le réactiver');
    expect(html).not.toContain('Déconnecter');
    expect(html).toContain('Retirer la déclaration @channel');
  });
  it('conserve les comptes historiques en lecture seule',()=>{
    const html=renderToStaticMarkup(createElement(SocialAccounts,{plan:'pro',initialTotal:1,initialItems:[{id:'legacy',platform:'youtube',handle:'archive',connection_kind:'unknown',connected_at:'2026-11-04'}]}));
    expect(html).toContain('connexion non vérifiée');expect(html).not.toContain('Retirer la déclaration @archive');
  });
  it('affiche une Page Facebook par son nom et expose le consentement global de déconnexion',()=>{
    const html=renderToStaticMarkup(createElement(SocialAccounts,{
      plan:'pro',initialTotal:1,initialConnectedTotal:1,
      initialItems:[{id:'facebook-page',platform:'facebook',handle:'123456789',display_name:'Page de test',connection_kind:'oauth',connected_at:'2026-11-14'}],
    }));
    expect(html).toContain('Facebook · Page de test');
    expect(html).toContain('Déconnecter les Pages');
    expect(html).toContain('Connexion indisponible');
  });
  it('montre la préférence persistée sans lancer une réécriture',()=>{
    const html=renderToStaticMarkup(createElement(AIPreferences,{initialTone:'institutionnel'}));
    expect(html).toContain('<option value="institutionnel" selected="">');
    expect(html).toContain('ne lance aucune analyse');
    expect(html).toMatch(/<button disabled=""[^>]*>Enregistrer le ton<\/button>/);
  });
});
