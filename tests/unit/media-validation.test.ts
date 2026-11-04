import { describe, expect, it } from 'vitest';
import { mediaPrepareSchema, mediaExtension, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES } from '../../lib/media/validation';
describe('Préparation des médias — sans crédits IA', () => {
  it('accepte les images dans la limite de taille', () => {
    expect(mediaPrepareSchema.safeParse({ mime:'image/png', size:MAX_IMAGE_BYTES }).success).toBe(true);
    expect(mediaPrepareSchema.safeParse({ mime:'image/png', size:MAX_IMAGE_BYTES+1 }).success).toBe(false);
  });
  it('limite les vidéos à 60 secondes et 50 Mo', () => {
    expect(mediaPrepareSchema.safeParse({ mime:'video/mp4', size:MAX_VIDEO_BYTES, durationSeconds:60 }).success).toBe(true);
    expect(mediaPrepareSchema.safeParse({ mime:'video/mp4', size:MAX_VIDEO_BYTES+1, durationSeconds:60 }).success).toBe(false);
    expect(mediaPrepareSchema.safeParse({ mime:'video/mp4', size:100, durationSeconds:61 }).success).toBe(false);
    expect(mediaPrepareSchema.safeParse({ mime:'video/mp4', size:100 }).success).toBe(false);
  });
  it('ne mélange pas image et vidéo dans un carrousel', () => {
    const groupId='ef123456-1234-4234-9234-123456789abc';
    expect(mediaPrepareSchema.safeParse({mime:'video/mp4',size:123,durationSeconds:15,groupId}).success).toBe(false);
    expect(mediaPrepareSchema.safeParse({mime:'image/webp',size:123,groupId}).success).toBe(true);
  });
  it('refuse les documents arbitraires et les clés étrangères', () => {
    expect(mediaPrepareSchema.safeParse({mime:'application/pdf',size:10}).success).toBe(false);
    expect(mediaPrepareSchema.safeParse({mime:'image/png',size:10,userId:'other'}).success).toBe(false);
    expect(mediaExtension('video/quicktime')).toBe('mov');
    expect(() => mediaExtension('image/svg+xml')).toThrow();
  });
});
