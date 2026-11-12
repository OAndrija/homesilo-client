/**
 * How much of the dashboard grid a tile covers, as columns × rows: 1×1, 1×2,
 * 2×1, 2×2, the full width, or the full width and two rows.
 */
export type TileSize = 'small' | 'tall' | 'medium' | 'large' | 'wide' | 'wide-tall';

/** Every size, smallest first; the order the size picker lists them in. */
export const TILE_SIZES: readonly TileSize[] = [
  'small',
  'tall',
  'medium',
  'large',
  'wide',
  'wide-tall',
];

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
  /** The tile's look, for tiles that have several; absent means the first (default) one. */
  variant?: string;
}

export interface TileVariant {
  id: string;
  label: string;
  icon: string;
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
  /** Looks the tile can take; the first is the default. */
  variants?: readonly TileVariant[];
}

/** What the server keeps; `customized` is false until someone saves a layout. */
export interface DashboardLayoutResponse {
  customized: boolean;
  tiles: { id: string; size: string; variant?: string | null }[];
  updatedAt: string | null;
}

export const TILE_SIZE_LABELS: Record<TileSize, { short: string; long: string }> = {
  small: { short: '1×1', long: 'Small' },
  tall: { short: '1×2', long: 'Tall' },
  medium: { short: '2×1', long: 'Wide' },
  large: { short: '2×2', long: 'Large' },
  wide: { short: 'Full', long: 'Full width' },
  'wide-tall': { short: 'Full×2', long: 'Full width, tall' },
};

export const TILES: readonly TileDefinition[] = [
  {
    id: 'storage',
    title: 'Storage',
    description: 'The silo, free space and what takes it up',
    icon: 'database',
    sizes: ['small', 'tall', 'medium', 'large', 'wide'],
    defaultSize: 'large',
    variants: [
      { id: 'silo', label: 'Silo', icon: 'warehouse' },
      { id: 'ring', label: 'Ring', icon: 'donut_large' },
      { id: 'bars', label: 'Bars', icon: 'bar_chart' },
    ],
  },
  {
    id: 'total-files',
    title: 'Total files',
    description: 'How many files you keep',
    icon: 'folder_copy',
    sizes: ['small', 'tall', 'medium', 'large'],
    defaultSize: 'small',
  },
  {
    id: 'added-week',
    title: 'Added this week',
    description: 'Files uploaded in the last 7 days',
    icon: 'trending_up',
    sizes: ['small', 'tall', 'medium', 'large'],
    defaultSize: 'small',
  },
  {
    id: 'starred-count',
    title: 'Starred',
    description: 'How many items you starred',
    icon: 'star',
    sizes: ['small', 'tall', 'medium', 'large'],
    defaultSize: 'small',
  },
  {
    id: 'largest-type',
    title: 'Largest file type',
    description: 'The kind of file that uses the most space',
    icon: 'pie_chart',
    sizes: ['small', 'tall', 'medium', 'large'],
    defaultSize: 'small',
  },
  {
    id: 'trash',
    title: 'Trash',
    description: 'Space used by deleted files',
    icon: 'delete',
    sizes: ['small', 'tall', 'medium', 'large'],
    defaultSize: 'small',
  },
  {
    id: 'quick-actions',
    title: 'Quick actions',
    description: 'Upload files and jump to your pages',
    icon: 'bolt',
    sizes: ['small', 'tall', 'medium', 'large', 'wide'],
    defaultSize: 'medium',
  },
  {
    id: 'starred-files',
    title: 'Starred files',
    description: 'Your starred files, one click away',
    icon: 'kid_star',
    sizes: ['tall', 'medium', 'large', 'wide', 'wide-tall'],
    defaultSize: 'wide',
  },
  {
    id: 'folders',
    title: 'Folders',
    description: 'The folders in My Files',
    icon: 'folder',
    sizes: ['tall', 'medium', 'large', 'wide', 'wide-tall'],
    defaultSize: 'wide',
  },
  {
    id: 'recent',
    title: 'Recent uploads',
    description: 'A table of your latest uploads',
    icon: 'schedule',
    sizes: ['medium', 'large', 'wide', 'wide-tall'],
    defaultSize: 'wide',
  },
  {
    id: 'photos',
    title: 'Recent photos',
    description: 'Previews of the pictures you uploaded last',
    icon: 'photo_library',
    sizes: ['tall', 'medium', 'large', 'wide', 'wide-tall'],
    defaultSize: 'wide',
  },
  {
    id: 'activity',
    title: 'Recent activity',
    description: 'Sign-ins and changes to your account',
    icon: 'history',
    sizes: ['tall', 'medium', 'large', 'wide', 'wide-tall'],
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
export function normalizeLayout(
  tiles: readonly { id: string; size: string; variant?: string | null }[],
): PlacedTile[] {
  const seen = new Set<string>();
  const result: PlacedTile[] = [];
  for (const tile of tiles) {
    const def = TILES.find((t) => t.id === tile.id);
    if (!def || seen.has(def.id)) continue;
    seen.add(def.id);
    const size = def.sizes.includes(tile.size as TileSize)
      ? (tile.size as TileSize)
      : def.defaultSize;
    const variant = variantOf(def, tile.variant);
    result.push(variant ? { id: def.id, size, variant } : { id: def.id, size });
  }
  return result;
}

/** A known, non-default look of the tile, or undefined for its default. */
export function variantOf(
  def: TileDefinition,
  variant: string | null | undefined,
): string | undefined {
  const known = def.variants?.some((v) => v.id === variant);
  return known && variant !== def.variants![0].id ? variant! : undefined;
}

export function sameLayout(a: readonly PlacedTile[], b: readonly PlacedTile[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (t, i) =>
        t.id === b[i].id && t.size === b[i].size && (t.variant ?? null) === (b[i].variant ?? null),
    )
  );
}
