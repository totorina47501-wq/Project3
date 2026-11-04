// Détecte les exportations tronquées, y compris lorsque Supabase plafonne
// implicitement la réponse au nombre de lignes autorisées par son API.
export const PERSONAL_EXPORT_PAGE_LIMIT = 1000;

export function isExportTruncated(
  count: number | null | undefined, returned: number, limit = PERSONAL_EXPORT_PAGE_LIMIT,
): boolean {
  if (typeof count === 'number' && Number.isSafeInteger(count) && count >= 0) {
    return count > returned;
  }
  // Sans décompte exact, indiquer prudemment un risque de troncature à la limite.
  return returned >= limit;
}
