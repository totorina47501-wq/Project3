// Sélection pure des médias expirés. N'efface jamais une preuve de vérification.
export type Candidate = {
  id: string; user_id: string; storage_path: string;
  status: string; expires_at: string;
};
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const OWNER_PATH = new RegExp('^('+UUID+')/('+UUID+')\\.(jpg|png|webp|mp4|mov)$','i');
// Les URL d'upload signées peuvent rester valides deux heures : marge de sécurité.
export const PENDING_GRACE_MS = 3 * 60 * 60 * 1000;

export function validateOwnedMediaPath(row: Candidate): boolean {
  const matched = OWNER_PATH.exec(row.storage_path);
  return !!matched && matched[1]?.toLowerCase() === row.user_id.toLowerCase();
}

export function selectExpiredMedia(
  rows: Candidate[], referencedPaths: ReadonlySet<string>, now = Date.now(),
): Candidate[] {
  return rows.filter((row) => {
    if (!validateOwnedMediaPath(row) || referencedPaths.has(row.storage_path)) return false;
    if (row.status !== 'pending' && row.status !== 'ready') return false;
    const expires = Date.parse(row.expires_at);
    if (!Number.isFinite(expires)) return false;
    const grace = row.status === 'pending' ? PENDING_GRACE_MS : 0;
    return expires + grace < now;
  });
}
