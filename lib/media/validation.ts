// Validation serveur et navigateur : préparation seulement, aucune analyse IA.
import { z } from 'zod';

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime'] as const;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_VIDEO_DURATION_SECONDS = 60;
export const MAX_CAROUSEL_IMAGES = 5;

export const mediaPrepareSchema = z.object({
  mime: z.enum([...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES]),
  size: z.number().int().min(1).max(MAX_VIDEO_BYTES),
  durationSeconds: z.number().int().min(1).max(MAX_VIDEO_DURATION_SECONDS).optional(),
  groupId: z.string().uuid().optional(),
}).strict().superRefine((input, context) => {
  if (isVideo(input.mime)) {
    if (!input.durationSeconds)
      context.addIssue({ code: 'custom', message: 'Durée vidéo requise (60 s maximum).' });
    if (input.groupId)
      context.addIssue({ code: 'custom', message: 'Une vidéo ne peut pas rejoindre un carrousel.' });
  } else {
    if (input.size > MAX_IMAGE_BYTES)
      context.addIssue({ code: 'custom', message: 'Image trop volumineuse (8 Mo).' });
    if (input.durationSeconds !== undefined)
      context.addIssue({ code: 'custom', message: 'Une image ne comporte pas de durée vidéo.' });
  }
});

export function isVideo(mime: string): boolean {
  return (VIDEO_MIME_TYPES as readonly string[]).includes(mime);
}
export function mediaExtension(mime: string): string {
  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    'video/mp4': 'mp4', 'video/quicktime': 'mov',
  };
  const ext = extensions[mime];
  if (!ext) throw new Error('Type MIME non autorisé.');
  return ext;
}
export function mediaLimitText(mime: string): string {
  return isVideo(mime) ? 'Vidéo MP4/MOV, 50 Mo et 60 s maximum.'
    : 'Image JPEG/PNG/WebP, 8 Mo maximum.';
}
