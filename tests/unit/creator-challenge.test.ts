import { describe, expect, it } from 'vitest';
import {
  creatorChallengeMissionCount,
  creatorChallengeStoragePrefix,
  creatorChallengeWeeks,
  defaultCreatorChallengeProgress,
  getCreatorChallengeProgressForAccount,
  getCreatorChallengeStorageKey,
  parseCreatorChallengeProgress,
  personalizeCreatorChallengeMission,
} from '../../lib/creator-challenge/model';

describe('programme créateur de 30 jours', () => {
  it('propose 30 missions pratiques réparties sur quatre semaines', () => {
    expect(creatorChallengeWeeks.map((week) => week.missions.length)).toEqual([7, 8, 8, 7]);
    expect(creatorChallengeWeeks.reduce((total, week) => total + week.missions.length, 0)).toBe(creatorChallengeMissionCount);
    const copy = JSON.stringify(creatorChallengeWeeks).toLocaleLowerCase('fr');
    expect(copy).not.toMatch(/nous te garantissons|garantis des abonnés|revenus assurés|conformité garantie/);
  });

  it('adapte les consignes avec des options prédéfinies et garde les valeurs stockées bornées', () => {
    const mission = personalizeCreatorChallengeMission(
      { day: 1, week: 1, title: 'Choisir un fil rouge', detail: 'Explore {{niche}} sur {{platform}} pour {{goal}}.' },
      { niche: 'cuisine', platform: 'tiktok', goal: 'communaute' },
    );
    expect(mission.detail).toContain('Cuisine');
    expect(mission.detail).toContain('TikTok');
    expect(mission.detail).toContain('Échanger avec une communauté');

    expect(parseCreatorChallengeProgress(JSON.stringify({
      started: true,
      completedDays: [1, 1, 31, 2.5, '3'],
      niche: 'cuisine',
      platform: 'tiktok',
      goal: 'communaute',
      email: 'not persisted',
    }))).toEqual({
      started: true,
      completedDays: [1],
      niche: 'cuisine',
      platform: 'tiktok',
      goal: 'communaute',
    });
  });

  it('isole la clé de stockage par compte sans stocker son identifiant brut', () => {
    const accountA = getCreatorChallengeStorageKey('a'.repeat(64));
    const accountB = getCreatorChallengeStorageKey('b'.repeat(64));
    expect(accountA).not.toBe(accountB);
    expect(accountA).toMatch(new RegExp(`^${creatorChallengeStoragePrefix}[a-f0-9]{64}$`));
    expect(() => getCreatorChallengeStorageKey('invalid')).toThrow();
    expect(parseCreatorChallengeProgress('{invalid')).toEqual(defaultCreatorChallengeProgress);
  });

  it('ne réutilise jamais l’état chargé sous la clé du compte précédent', () => {
    const stored = {
      storageKey: 'account-a',
      progress: { ...defaultCreatorChallengeProgress, started: true, completedDays: [1] },
    };
    expect(getCreatorChallengeProgressForAccount(stored, 'account-a')).toEqual(stored.progress);
    expect(getCreatorChallengeProgressForAccount(stored, 'account-b')).toEqual(defaultCreatorChallengeProgress);
  });
});
