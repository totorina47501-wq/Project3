// Chemin : tests/unit/check-schema.test.ts
import { describe, expect, it } from 'vitest';
import { checkInputSchema } from '../../lib/ai/schemas';

describe('Validation des requêtes de vérification', () => {
  it('valide une légende sans média', () => {
    expect(checkInputSchema.safeParse({ caption: 'Publicité — démonstration.', platform: 'instagram' }).success).toBe(true);
  });
  it('refuse les champs inconnus et les liens externes', () => {
    expect(checkInputSchema.safeParse({
      caption: 'Publicité', platform: 'instagram', mediaUrl: 'https://evil.test/logo.png',
      mediaType: 'image', userId: 'fake',
    }).success).toBe(false);
  });
  it('refuse un média déclaré sans chemin', () => {
    expect(checkInputSchema.safeParse({
      caption: 'Publicité', platform: 'tiktok', mediaType: 'image',
    }).success).toBe(false);
  });
  it('refuse une plateforme absente du périmètre', () => {
    expect(checkInputSchema.safeParse({
      caption: 'Publicité', platform: 'autre', mediaType: 'none',
    }).success).toBe(false);
  });
});
