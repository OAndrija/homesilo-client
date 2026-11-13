import { Folder } from './folder';

export type SortKey = 'name' | 'size' | 'date';
export type SortDirection = 'asc' | 'desc';

export interface SortState {
  key: SortKey;
  direction: SortDirection;
}

/** Which timestamp the "date" column shows: last change, or when it was trashed. */
export type DateField = 'lastModified' | 'trashedAt';

export const DEFAULT_SORT: SortState = { key: 'date', direction: 'desc' };

/** The `sort` query parameter for paged file lists (Spring Data: "property,direction"). */
export function fileSortParam(sort: SortState, dateField: DateField = 'lastModified'): string {
  const property =
    sort.key === 'name' ? 'originalFileName' : sort.key === 'size' ? 'size' : dateField;
  return `${property},${sort.direction}`;
}

/**
 * Folders come back as one unpaged list, so they're sorted here. They have no
 * size, so a size sort orders them by name.
 */
export function sortFolders(
  folders: Folder[],
  sort: SortState,
  dateField: DateField = 'lastModified',
): Folder[] {
  const factor = sort.direction === 'asc' ? 1 : -1;
  const byName = (a: Folder, b: Folder) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  return [...folders].sort((a, b) => {
    if (sort.key === 'date') {
      const at = (dateField === 'trashedAt' ? a.trashedAt : null) ?? a.lastModified;
      const bt = (dateField === 'trashedAt' ? b.trashedAt : null) ?? b.lastModified;
      return factor * (Date.parse(at) - Date.parse(bt)) || byName(a, b);
    }
    return (sort.key === 'name' ? factor : 1) * byName(a, b);
  });
}

/** Clicking a column: same column flips direction; a new one starts in its natural order. */
export function nextSort(current: SortState, key: SortKey): SortState {
  if (current.key === key) {
    return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { key, direction: key === 'name' ? 'asc' : 'desc' };
}

export const SORT_KEYS: readonly SortKey[] = ['name', 'size', 'date'];
