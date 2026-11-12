/** How much of the dashboard grid a tile covers: 1×1, 2×1, 2×2 or the full row. */
export type TileSize = 'small' | 'medium' | 'large' | 'wide';

export type TileId =
  | 'storage'
  | 'total-files'
  | 'added-week'
  | 'starred-count'
  | 'largest-type'
  | 'trash'
  | 'quick-actions'
  | 'starred-files'
  | 'folders'
  | 'recent'
  | 'photos'
  | 'activity';

export interface PlacedTile {
  id: TileId;
  size: TileSize;
}

export interface TileDefinition {
  id: TileId;
  title: string;
  /** One line for the "Add tiles" tray. */
  description: string;
  icon: string;
  /** Sizes the tile can take, smallest first. */
  sizes: readonly TileSize[];
  defaultSize: TileSize;
}

/** What the server keeps; `customized` is false until someone saves a layout. */
export interface DashboardLayoutResponse {
  customized: boolean;
  tiles: { id: string; size: string }[];
  updatedAt: string | null;
}

export const TILE_SIZE_LABELS: Record<TileSize, { short: string; long: string }> = {
  small: { short: '1×1', long: 'Small' },
  medium: { short: '2×1', long: 'Medium' },
  large: { short: '2×2', long: 'Large' },
  wide: { short: 'Full', long: 'Full width' },
};

export const TILES: readonly TileDefinition[] = [
  {
    id: 'storage',
    title: 'Storage',
    description: 'The silo, free space and what takes it up',
    icon: 'database',
    sizes: ['small', 'medium', 'large', 'wide'],
    defaultSize: 'large',
  },
  {
    id: 'total-files',
    title: 'Total files',
    description: 'How many files you keep',
    icon: 'folder_copy',
    sizes: ['small', 'medium'],
    defaultSize: 'small',
  },
  {
    id: 'added-week',
    title: 'Added this week',
    description: 'Files uploaded in the last 7 days',
    icon: 'trending_up',
    sizes: ['small', 'medium'],
    defaultSize: 'small',
  },
  {
    id: 'starred-count',
    title: 'Starred',
    description: 'How many items you starred',
    icon: 'star',
    sizes: ['small', 'medium'],
    defaultSize: 'small',
  },
  {
    id: 'largest-type',
    title: 'Largest file type',
    description: 'The kind of file that uses the most space',
    icon: 'pie_chart',
    sizes: ['small', 'medium'],
    defaultSize: 'small',
  },
  {
    id: 'trash',
    title: 'Trash',
    description: 'Space used by deleted files',
    icon: 'delete',
    sizes: ['small', 'medium'],
    defaultSize: 'small',
  },
  {
    id: 'quick-actions',
    title: 'Quick actions',
    description: 'Upload files and jump to your pages',
    icon: 'bolt',
    sizes: ['small', 'medium', 'wide'],
    defaultSize: 'medium',
  },
  {
    id: 'starred-files',
    title: 'Starred files',
    description: 'Your starred files, one click away',
    icon: 'kid_star',
    sizes: ['medium', 'large', 'wide'],
    defaultSize: 'wide',
  },
  {
    id: 'folders',
    title: 'Folders',
    description: 'The folders in My Files',
    icon: 'folder',
    sizes: ['medium', 'large', 'wide'],
    defaultSize: 'wide',
  },
  {
    id: 'recent',
    title: 'Recent uploads',
    description: 'A table of your latest uploads',
    icon: 'schedule',
    sizes: ['medium', 'large', 'wide'],
    defaultSize: 'wide',
  },
  {
    id: 'photos',
    title: 'Recent photos',
    description: 'Previews of the pictures you uploaded last',
    icon: 'photo_library',
    sizes: ['medium', 'large', 'wide'],
    defaultSize: 'wide',
  },
  {
    id: 'activity',
    title: 'Recent activity',
    description: 'Sign-ins and changes to your account',
    icon: 'history',
    sizes: ['medium', 'large', 'wide'],
    defaultSize: 'medium',
  },
];

export const DEFAULT_LAYOUT: readonly PlacedTile[] = [
  { id: 'storage', size: 'large' },
  { id: 'total-files', size: 'small' },
  { id: 'added-week', size: 'small' },
  { id: 'starred-count', size: 'small' },
  { id: 'largest-type', size: 'small' },
  { id: 'starred-files', size: 'wide' },
  { id: 'folders', size: 'wide' },
  { id: 'recent', size: 'wide' },
];

export function tileDefinition(id: TileId): TileDefinition {
  return TILES.find((t) => t.id === id)!;
}

/**
 * Keeps only tiles this version of the app knows, each once, at a size it allows
 * (a saved layout can come from an older or newer version of the app).
 */
export function normalizeLayout(tiles: readonly { id: string; size: string }[]): PlacedTile[] {
  const seen = new Set<string>();
  const result: PlacedTile[] = [];
  for (const tile of tiles) {
    const def = TILES.find((t) => t.id === tile.id);
    if (!def || seen.has(def.id)) continue;
    seen.add(def.id);
    const size = def.sizes.includes(tile.size as TileSize)
      ? (tile.size as TileSize)
      : def.defaultSize;
    result.push({ id: def.id, size });
  }
  return result;
}

export function sameLayout(a: readonly PlacedTile[], b: readonly PlacedTile[]): boolean {
  return a.length === b.length && a.every((t, i) => t.id === b[i].id && t.size === b[i].size);
}
