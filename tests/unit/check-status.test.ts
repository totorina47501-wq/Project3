import { describe, it, expect } from 'vitest';
import { checkLabel, isScoredCheck } from '../../lib/check-status';
describe('Affichage des vérifications du cockpit', () => {
  it('affiche un échec même lorsque le score est absent', () => {
    expect(checkLabel('failed', null)).toBe('Échec — à relancer');
    expect(isScoredCheck({ status: 'failed', ai_score: null })).toBe(false);
  });
  it('distingue attente et traitement', () => {
    expect(checkLabel('queued', null)).toBe('En attente');
    expect(checkLabel('processing', null)).toBe('En traitement');
  });
  it('n attribue pas de score aux erreurs', () => {
    expect(isScoredCheck({ status: 'failed', ai_score: 85 })).toBe(false);
    expect(checkLabel('failed', 85)).toBe('Échec — à relancer');
  });
  it('affiche le score des contrôles terminés', () => {
    expect(checkLabel('completed', 86)).toBe('86/100');
    expect(isScoredCheck({ status: 'completed', ai_score: 86 })).toBe(true);
    expect(checkLabel('completed', null)).toBe('Résultat indisponible');
    expect(checkLabel('accepted', 100)).toBe('100/100');
  });
  it('traite explicitement les statuts inattendus', () => {
    expect(checkLabel('unknown', null)).toBe('Statut indisponible');
  });
});
