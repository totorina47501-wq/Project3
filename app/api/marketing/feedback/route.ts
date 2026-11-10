import { z } from 'zod';
import { isSameOrigin } from '@/lib/security/origin';
import { HttpError, publicError } from '@/lib/security/auth';
import { deleteMarketingFeedback, storeMarketingFeedback } from '@/lib/marketing/feedback-store';

export const runtime = 'nodejs';

const bodyLimitBytes = 4 * 1024;
const optionalTrimmed = z.string().trim().max(120).optional().transform((value) => value || null);
const postSchema = z.object({
  message: z.string().trim().min(20).max(1200),
  sourceUrl: z.string().trim().url().max(2048).optional().transform((value) => value || null),
  consent: z.literal(true),
  origin: z.enum(['landing', 'guide']),
  utm: z.object({
    source: optionalTrimmed,
    medium: optionalTrimmed,
    campaign: optionalTrimmed,
  }).optional().transform((value) => value ?? null),
}).strict();

const deleteSchema = z.object({
  feedbackId: z.string().uuid(),
  deleteToken: z.string().uuid(),
}).strict();

async function readJson(request: Request): Promise<unknown> {
  const length = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(length) && length > bodyLimitBytes) {
    throw new HttpError(413, 'Le formulaire dépasse la limite autorisée.');
  }
  const text = await request.text();
  if (text.length > bodyLimitBytes) throw new HttpError(413, 'Le formulaire dépasse la limite autorisée.');
  try {
    return JSON.parse(text || '{}') as unknown;
  } catch {
    throw new HttpError(400, 'Requête JSON invalide.');
  }
}

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) throw new HttpError(403, 'Origine de la requête interdite.');
    const payload = postSchema.safeParse(await readJson(request));
    if (!payload.success) throw new HttpError(422, 'Feedback invalide.');
    const receipt = storeMarketingFeedback(payload.data);
    return Response.json({
      ...receipt,
      retention: 'local_stub',
      message: 'Merci, votre retour a été reçu.',
    }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    const { status, message } = publicError(error);
    return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'private, no-store' } });
  }
}

export async function DELETE(request: Request) {
  try {
    if (!isSameOrigin(request)) throw new HttpError(403, 'Origine de la requête interdite.');
    const payload = deleteSchema.safeParse(await readJson(request));
    if (!payload.success) throw new HttpError(422, 'Suppression invalide.');
    const removed = deleteMarketingFeedback(payload.data.feedbackId, payload.data.deleteToken);
    if (!removed) throw new HttpError(404, 'Retour introuvable ou déjà supprimé.');
    return Response.json({ deleted: true }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const { status, message } = publicError(error);
    return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
