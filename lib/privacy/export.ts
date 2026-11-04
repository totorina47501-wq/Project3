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

export type ExportPage<T> = { data: T[] | null; count?: number | null; error: unknown };
// Ne pas confondre page courte et fin : max_rows Supabase peut réduire la page.
export async function collectPages<T>(read: (offset: number, size: number) => PromiseLike<ExportPage<T>>,
  maxRows = 100_000): Promise<T[]> {
  const rows: T[] = [];
  let expected: number | undefined;
  for (;;) {
    const result = await read(rows.length, PERSONAL_EXPORT_PAGE_LIMIT);
    if (result.error || !result.data || !Number.isSafeInteger(result.count) || (result.count ?? -1) < 0)
      throw new Error('Export indisponible ou décompte absent.');
    const count = result.count as number;
    if (expected !== undefined && expected !== count) throw new Error('Les données ont changé pendant l’export. Réessaie.');
    expected = count;
    if (count > maxRows || rows.length + result.data.length > maxRows) throw new ExportLimitError();
    rows.push(...result.data);
    if (rows.length === count) return rows;
    if (!result.data.length || rows.length > count) throw new Error('Export incomplet.');
  }
}

export type PrivateFile = { bucket: string; path: string; id: string; metadata: unknown };
type StorageEntry = { id?: string | null; name: string; metadata?: unknown };
export async function listPrivateFiles(bucket: string, owner: string,
  read: (prefix: string, offset: number) => PromiseLike<{ data: StorageEntry[] | null; error: unknown }>,
): Promise<PrivateFile[]> {
  const files: PrivateFile[] = [];
  const folders = [owner];
  const seenFolders = new Set(folders);
  let entries = 0;
  for (let index = 0; index < folders.length; index++) {
    const prefix = folders[index]!;
    let offset = 0;
    for (;;) {
      const result = await read(prefix, offset);
      if (result.error || !result.data) throw new Error('Inventaire des fichiers indisponible.');
      if (!result.data.length) break;
      offset += result.data.length;
      entries += result.data.length;
      if (entries > 100_000) throw new ExportLimitError();
      for (const item of result.data) {
        if (!item.name || item.name === '.' || item.name === '..' || /[/\\\x00-\x1f]/.test(item.name))
          throw new Error('Chemin de fichier invalide.');
        const path = `${prefix}/${item.name}`;
        if (item.id) files.push({ bucket, path, id: item.id, metadata: item.metadata ?? null });
        else {
          if (path.split('/').length > 16 || seenFolders.has(path)) throw new Error('Arborescence de fichiers invalide.');
          seenFolders.add(path);
          folders.push(path);
        }
      }
    }
  }
  return files;
}

export class ExportLimitError extends Error {
  constructor() { super('L’export dépasse la limite de traitement. Une extraction accompagnée est nécessaire.'); }
}
