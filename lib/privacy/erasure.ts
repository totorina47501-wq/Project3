import { z } from 'zod';

// Le mot de confirmation réduit les demandes accidentelles ; un consentement
// explicite de l'utilisateur reste nécessaire pour déclencher ce workflow.
export const erasureActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('request'), confirmation: z.literal('SUPPRIMER') }).strict(),
  z.object({ action: z.literal('cancel') }).strict(),
  z.object({ action: z.literal('preview') }).strict(),
]);
export const erasureStatusSchema = z.enum([
  'requested', 'reviewing', 'cancelled', 'completed', 'rejected',
]);
export type ErasureStatus = z.infer<typeof erasureStatusSchema>;
export const ACTIVE_ERASURE_STATUSES: ReadonlySet<ErasureStatus> =
  new Set(['requested','reviewing']);

export function canCancelErasure(status: ErasureStatus): boolean {
  return status === 'requested';
}

export function requiresErasureCooldown(status: ErasureStatus,
  date: string, now = Date.now()): boolean {
  if (status !== 'cancelled') return false;
  const elapsed = now - Date.parse(date);
  return Number.isFinite(elapsed) && elapsed >= 0 && elapsed < 60_000;
}
