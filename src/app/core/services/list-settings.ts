import { inject, linkedSignal, WritableSignal } from '@angular/core';
import { PreferencesService } from './preferences';

/**
 * How each list is shown (list or grid) and sorted, kept with the account.
 * A page holds them as writable signals that follow the account's settings, so
 * they change when the settings arrive from the server or another account
 * signs in, and the page saves a change with {@link PreferencesService.set}.
 */

export type FileView = 'list' | 'grid';

export interface Sort<K extends string> {
  key: K;
  direction: 'asc' | 'desc';
}

/** The page's view, following the account's setting. Call where `inject` works. */
export function viewSetting(page: string): WritableSignal<FileView> {
  const prefs = inject(PreferencesService);
  return linkedSignal(() => (prefs.values()[`view.${page}`] === 'grid' ? 'grid' : 'list'));
}

/** The setting change for a new view; the default (list) isn't stored. */
export function viewChange(page: string, view: FileView): Record<string, string | null> {
  return { [`view.${page}`]: view === 'list' ? null : view };
}

/** The page's sort, following the account's setting. Call where `inject` works. */
export function sortSetting<K extends string>(
  page: string,
  keys: readonly K[],
  fallback: Sort<K>,
): WritableSignal<Sort<K>> {
  const prefs = inject(PreferencesService);
  return linkedSignal(() => parseSort(prefs.values()[`sort.${page}`], keys) ?? fallback);
}

/** The setting change for a new sort; the page's default isn't stored. */
export function sortChange<K extends string>(
  page: string,
  sort: Sort<K>,
  fallback: Sort<K>,
): Record<string, string | null> {
  const same = sort.key === fallback.key && sort.direction === fallback.direction;
  return { [`sort.${page}`]: same ? null : `${sort.key},${sort.direction}` };
}

/** "name,asc" as a sort, if the column is one this page has. */
export function parseSort<K extends string>(
  value: string | undefined,
  keys: readonly K[],
): Sort<K> | null {
  const [key, direction] = (value ?? '').split(',');
  if (!keys.includes(key as K) || (direction !== 'asc' && direction !== 'desc')) return null;
  return { key: key as K, direction };
}
