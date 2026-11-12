import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  HostListener,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { debounceTime, finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Files } from '../../core/services/files';
import { Folders } from '../../core/services/folders';
import { DashboardStore } from '../../core/services/dashboard-store';
import { FileMetadata } from '../../core/models/file-metadata';
import { Folder } from '../../core/models/folder';
import { FileTable } from '../../shared/file-table/file-table';
import { Auth } from '../../core/services/auth';
import { FileActions } from '../../core/services/file-actions';
import { UploadService } from '../../core/services/uploads';
import { formatBytes } from '../../core/utils/format';
import { getFileIcon } from '../../core/utils/file-icon.util';
import { FriendlyDatePipe } from '../../shared/pipes/friendly-date';
import { reducedMotion, spans, TileGestures } from './tile-gestures';
import { ActivityItem } from '../../shared/activity-item/activity-item';
import { ActivityApi } from '../../core/services/activity';
import { ActivityEntry } from '../../core/models/activity';
import { DashboardLayoutService } from '../../core/services/dashboard-layout';
import { ToastService } from '../../core/services/toast';
import { errorMessage } from '../../core/http/http-error';
import {
  DEFAULT_LAYOUT,
  PlacedTile,
  sameLayout,
  TILE_SIZE_LABELS,
  TileDefinition,
  TileId,
  TILES,
  TileSize,
  tileDefinition,
} from '../../core/models/dashboard-layout';

// Colours live in styles.css (--cat-*) so they adapt to light/dark themes.
const CATEGORY_META: Record<string, { color: string; icon: string }> = {
  Documents: { color: 'var(--cat-documents)', icon: 'description' },
  Images: { color: 'var(--cat-images)', icon: 'image' },
  Videos: { color: 'var(--cat-videos)', icon: 'movie' },
  Audio: { color: 'var(--cat-audio)', icon: 'audiotrack' },
  Archives: { color: 'var(--cat-archives)', icon: 'folder_zip' },
  Other: { color: 'var(--cat-other)', icon: 'draft' },
  Trash: { color: 'var(--cat-trash)', icon: 'delete' },
};

@Component({
  selector: 'app-home',
  imports: [FileTable, RouterLink, FriendlyDatePipe, ActivityItem],
  templateUrl: './home.html',
  styleUrls: ['./home.css', './dashboard-tiles.css'],
})
export class Home {
  private fileService = inject(Files);
  private folderService = inject(Folders);
  private uploads = inject(UploadService);
  private store = inject(DashboardStore);
  private authService = inject(Auth);
  private fileActions = inject(FileActions);
  private activityApi = inject(ActivityApi);
  private layout = inject(DashboardLayoutService);
  private toast = inject(ToastService);
  private injector = inject(Injector);
  private grid = viewChild<ElementRef<HTMLElement>>('grid');

  username = computed(() => this.authService.user()?.username ?? '');
  userId = computed(() => this.authService.user()?.id ?? null);

  /** The latest uploads; the table shows the first few, Recent photos picks the pictures. */
  private recentUploads = signal<FileMetadata[]>([]);
  recentFiles = computed(() => this.recentUploads().slice(0, 8));
  photos = computed(() =>
    this.recentUploads().filter((f) => f.contentType.startsWith('image/') && f.thumbnail),
  );
  activity = signal<ActivityEntry[]>([]);
  activityLoading = signal(false);
  private activityLoaded = false;
  loadingRecent = signal(true);
  starredFiles = signal<FileMetadata[]>([]);
  folders = signal<Folder[]>([]);
  loadingFolders = signal(true);

  // Uploads (button or drag-and-drop) go to the root of My Files, via the upload panel.
  dragging = signal(false);
  private dragCounter = 0;

  // Derived straight from the store — no local copies that can drift out of sync.
  totalFiles = computed(() => this.store.stats()?.totalFiles ?? 0);
  filesThisWeek = computed(() => this.store.stats()?.filesThisWeek ?? 0);
  storageUsedBytes = computed(() => this.store.stats()?.storageUsedBytes ?? 0);
  storageLimitBytes = computed(() => this.store.stats()?.storageQuotaBytes ?? 1);
  /** A brand-new account: nothing uploaded, no folders yet. */
  isEmpty = computed(
    () =>
      !!this.store.stats() &&
      !this.loadingFolders() &&
      this.totalFiles() === 0 &&
      this.folders().length === 0,
  );

  starredCount = computed(() => this.store.stats()?.starredCount ?? 0);

  storageUsedGB = computed(() => (this.storageUsedBytes() / 1024 ** 3).toFixed(1));
  storageLimitGB = computed(() => Math.round(this.storageLimitBytes() / 1024 ** 3));
  storageFreeBytes = computed(() =>
    Math.max(this.storageLimitBytes() - this.storageUsedBytes(), 0),
  );

  /** Split into number + unit so the template can style them separately. */
  storageFree = computed(() => {
    const [value, unit] = this.formatSize(this.storageFreeBytes()).split(' ');
    return { value, unit };
  });
  storageFreeLabel = computed(() => this.formatSize(this.storageFreeBytes()));

  // Clamped so an over-quota account can't push the silo or percentages out of range.
  storagePercent = computed(() =>
    Math.min(
      100,
      Math.max(0, Math.round((this.storageUsedBytes() / this.storageLimitBytes()) * 100)),
    ),
  );
  storageFreePercent = computed(() => 100 - this.storagePercent());

  /** ok → warn → critical; drives the glow and status pill. */
  storageLevel = computed<'ok' | 'warn' | 'critical'>(() => {
    const p = this.storagePercent();
    return p >= 90 ? 'critical' : p >= 75 ? 'warn' : 'ok';
  });

  // ── Silo (homesilo-silo.png): the body spans 26% → 99% of the image height ──
  private readonly siloBodyTop = 26;
  private readonly siloBodyBottom = 99;

  breakdownWithPercent = computed(() => {
    const used = this.storageUsedBytes();
    const limit = this.storageLimitBytes();
    const breakdown = this.store.stats()?.storageBreakdown ?? [];
    return [...breakdown]
      .filter((t) => t.bytes > 0)
      .sort((a, b) => b.bytes - a.bytes)
      .map((t) => {
        const meta = CATEGORY_META[t.category] ?? CATEGORY_META['Other'];
        return {
          label: t.category,
          color: meta.color,
          icon: meta.icon,
          bytes: t.bytes,
          sizeLabel: this.formatSize(t.bytes),
          percent: used > 0 ? Math.round((t.bytes / used) * 100) : 0,
          ofCapacity: limit > 0 ? t.bytes / limit : 0,
          capacityPct: limit > 0 ? Math.min((t.bytes / limit) * 100, 100) : 0,
          capacityLabel: this.formatPercent(limit > 0 ? (t.bytes / limit) * 100 : 0),
        };
      });
  });

  /** Biggest file type (the breakdown is already sorted by size); null while empty. */
  topCategory = computed(() => this.breakdownWithPercent().at(0) ?? null);

  /** Where the colour starts, as a % from the top of the image; any usage shows a sliver. */
  siloFillTop = computed(() => {
    const used = this.storageUsedBytes();
    const limit = this.storageLimitBytes();
    const body = this.siloBodyBottom - this.siloBodyTop;
    if (used <= 0 || limit <= 0) return 100;
    const filled = Math.max(Math.min(used / limit, 1) * body, 1.5);
    return Math.round((this.siloBodyBottom - filled) * 10) / 10;
  });

  /** "1.2 GB", or "Empty" when nothing is in the trash. */
  trashLabel = computed(() => {
    const bytes = this.store.stats()?.trashedBytes ?? 0;
    return bytes > 0 ? this.formatSize(bytes) : 'Empty';
  });

  constructor() {
    this.layout.load();
    // Recent activity is only fetched once its tile is on the dashboard.
    effect(() => {
      if (this.shownTiles().some((t) => t.id === 'activity')) this.loadActivity();
    });
    // Keep the size picker next to its tile as tiles move and change size.
    effect(() => {
      this.draft();
      if (!this.selected()) return;
      afterNextRender({ write: () => this.placePicker() }, { injector: this.injector });
    });
    inject(DestroyRef).onDestroy(() => this.saveOnLeave());
    this.store.ensureLoaded();
    this.loadRecentFiles();
    this.loadStarred();
    this.loadFolders();

    // New uploads show up in "Recent uploads" (batched, so one reload per burst).
    this.uploads.uploaded
      .pipe(debounceTime(400), takeUntilDestroyed())
      .subscribe(() => this.loadRecentFiles());
  }

  private loadRecentFiles(): void {
    this.fileService
      .listRecentlyUploadedActive(0, 24)
      .pipe(finalize(() => this.loadingRecent.set(false)))
      .subscribe({
        next: (response) => this.recentUploads.set(response.content),
      });
  }

  private loadStarred(): void {
    this.fileService.listStarred(0).subscribe({
      next: (response) => this.starredFiles.set(response.content.slice(0, 6)),
    });
  }

  private loadFolders(): void {
    this.folderService
      .getRootContents(0)
      .pipe(finalize(() => this.loadingFolders.set(false)))
      .subscribe({
        next: (contents) => this.folders.set(contents.subfolders.slice(0, 16)),
      });
  }

  downloadFile(file: FileMetadata): void {
    this.fileActions.download(file);
  }

  /** Opens the viewer, stepping through the section the file was clicked in. */
  /** Starred photos show their own preview; a failed one falls back to the icon. */
  brokenThumbs = signal<Set<string>>(new Set());

  thumbnailUrl(file: FileMetadata): string {
    return this.fileService.thumbnailUrl(file.id);
  }

  onThumbError(file: FileMetadata): void {
    this.brokenThumbs.update((s) => new Set(s).add(file.id));
  }

  openStarred(file: FileMetadata): void {
    this.fileActions.open(file, this.starredFiles());
  }

  openPhoto(file: FileMetadata): void {
    this.fileActions.open(file, this.photos());
  }

  private loadActivity(): void {
    if (this.activityLoaded) return;
    this.activityLoaded = true;
    this.activityLoading.set(true);
    this.activityApi
      .myActivity(0, 10)
      .pipe(finalize(() => this.activityLoading.set(false)))
      .subscribe({ next: (page) => this.activity.set(page.content) });
  }

  openRecent(file: FileMetadata): void {
    this.fileActions.open(file, this.recentFiles());
  }

  // ── Upload ────────────────────────────────────────────────────

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) this.upload(Array.from(input.files));
    input.value = '';
  }

  private upload(files: File[]): void {
    this.uploads.enqueue(files, null);
  }

  // ── Drag and drop anywhere on the page ────────────────────────

  onDragEnter(event: DragEvent): void {
    if (!hasFiles(event)) return;
    event.preventDefault();
    this.dragCounter++;
    this.dragging.set(true);
  }

  onDragOver(event: DragEvent): void {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'copy';
  }

  onDragLeave(event: DragEvent): void {
    if (!hasFiles(event)) return;
    this.dragCounter = Math.max(0, this.dragCounter - 1);
    if (this.dragCounter === 0) this.dragging.set(false);
  }

  onDrop(event: DragEvent): void {
    if (!hasFiles(event)) return;
    event.preventDefault();
    this.dragCounter = 0;
    this.dragging.set(false);
    const dropped = event.dataTransfer?.files;
    if (dropped && dropped.length > 0) this.upload(Array.from(dropped));
  }

  // ── Tiles ─────────────────────────────────────────────────────

  readonly sizeLabels = TILE_SIZE_LABELS;
  readonly definition = tileDefinition;

  editing = signal(false);
  /** The layout being edited; saved on Done, dropped on Cancel. */
  draft = signal<PlacedTile[]>([]);
  saving = signal(false);
  layoutReady = computed(() => this.layout.tiles() !== null);
  shownTiles = computed<PlacedTile[]>(() =>
    this.editing() ? this.draft() : (this.layout.tiles() ?? []),
  );
  hiddenTiles = computed<TileDefinition[]>(() =>
    TILES.filter((t) => !this.draft().some((p) => p.id === t.id)),
  );
  draftIsDefault = computed(() => sameLayout(this.draft(), DEFAULT_LAYOUT));
  /** For screen readers: what the last edit did. */
  announcement = signal('');
  /** Briefly highlights a tile that was just added. */
  justAdded = signal<TileId | null>(null);

  /**
   * How many items a list tile shows at each size, so its content fits the tile
   * (a 2×1 tile is one grid row, 2×2 two) instead of stretching the whole row.
   */
  private static readonly LIMITS: Partial<Record<TileId, Partial<Record<TileSize, number>>>> = {
    'starred-files': { tall: 4, medium: 4, large: 8, wide: 8, 'wide-tall': 16 },
    folders: { tall: 4, medium: 4, large: 8, wide: 8, 'wide-tall': 16 },
    recent: { medium: 2, large: 5, wide: 8, 'wide-tall': 16 },
    photos: { tall: 4, medium: 4, large: 8, wide: 8, 'wide-tall': 16 },
    activity: { tall: 4, medium: 2, large: 4, wide: 5, 'wide-tall': 10 },
  };

  limit(tile: PlacedTile): number {
    return Home.LIMITS[tile.id]?.[tile.size] ?? 8;
  }

  /** Pick up, carry, drop and resize tiles with a mouse, pen or finger. */
  readonly gestures = new TileGestures({
    grid: () => this.grid()?.nativeElement ?? null,
    tiles: () => this.draft(),
    moveTile: (id, to, skip) => this.moveTile(id, to, skip),
    resizeTile: (id, size) => this.setSize(id, size),
    restoreOrder: (tiles) =>
      this.animate(() => this.draft.set(tiles), this.gestures.lifted() ?? undefined),
    afterRender: (fn) => afterNextRender({ write: fn }, { injector: this.injector }),
    announce: (message) => this.announcement.set(message),
    tapped: (id) => this.toggleSelected(id),
    started: () => this.selected.set(null),
  });

  // ── Size picker ──────────────────────────────────────────────

  /** The tile whose sizes are shown, after a tap on it in edit mode. */
  selected = signal<TileId | null>(null);
  private picker = viewChild<ElementRef<HTMLElement>>('picker');
  selectedTile = computed(() => this.draft().find((t) => t.id === this.selected()) ?? null);

  toggleSelected(id: TileId, focusPicker = false): void {
    const next = this.selected() === id ? null : id;
    this.selected.set(next);
    if (!next) return;
    this.announcement.set(`${tileDefinition(id).title} selected. Choose a size.`);
    if (focusPicker) {
      afterNextRender(
        () =>
          this.picker()
            ?.nativeElement.querySelector<HTMLElement>('[aria-checked="true"]')
            ?.focus({ preventScroll: true }),
        { injector: this.injector },
      );
    }
  }

  /** Closes the picker; with `refocus`, the keyboard goes back to the tile. */
  closePicker(refocus = false): void {
    const id = this.selected();
    this.selected.set(null);
    if (refocus && id) this.tileElement(id)?.focus({ preventScroll: true });
  }

  /** Cells of a 4 × 2 grid that a size covers, for the picker's little diagrams. */
  sizeCells(size: TileSize): boolean[] {
    const [columns, rows] = spans(size, 4);
    return Array.from({ length: 8 }, (_, i) => i % 4 < columns && Math.floor(i / 4) < rows);
  }

  /** Arrow keys move between the sizes, as in any radio group. */
  onPickerKeydown(event: KeyboardEvent): void {
    const options = Array.from(
      this.picker()?.nativeElement.querySelectorAll<HTMLElement>('[role="radio"]') ?? [],
    );
    const index = options.indexOf(document.activeElement as HTMLElement);
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (!step || index < 0) return;
    event.preventDefault();
    options[(index + step + options.length) % options.length].focus();
  }

  /** Puts the picker under its tile (or above, near the bottom), inside the grid. */
  private placePicker(): void {
    const grid = this.grid()?.nativeElement;
    const picker = this.picker()?.nativeElement;
    const id = this.selected();
    const tile = id && this.tileElement(id);
    if (!grid || !picker || !tile) return;
    const gap = 10;
    const left = tile.offsetLeft + tile.offsetWidth / 2 - picker.offsetWidth / 2;
    const maxLeft = Math.max(0, grid.clientWidth - picker.offsetWidth);
    const below = tile.offsetTop + tile.offsetHeight + gap;
    const fitsBelow =
      tile.getBoundingClientRect().bottom + gap + picker.offsetHeight < window.innerHeight - 8;
    const top = fitsBelow ? below : tile.offsetTop - picker.offsetHeight - gap;
    picker.style.left = `${Math.min(Math.max(0, left), maxLeft)}px`;
    picker.style.top = `${Math.max(0, top)}px`;
    picker.classList.toggle('above', !fitsBelow);
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.selected()) this.placePicker();
  }

  /** A press outside the selected tile and its picker closes the picker. */
  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    if (!this.selected()) return;
    const target = event.target as Element | null;
    if (target?.closest('[data-tile], .size-picker')) return;
    this.closePicker();
  }

  /** The draft differs from what is saved. */
  private dirty = computed(
    () => this.editing() && !sameLayout(this.draft(), this.layout.tiles() ?? DEFAULT_LAYOUT),
  );

  startEdit(): void {
    this.draft.set([...(this.layout.tiles() ?? DEFAULT_LAYOUT)]);
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.gestures.dispose();
    this.selected.set(null);
    this.editing.set(false);
  }

  finishEdit(): void {
    this.gestures.dispose();
    this.selected.set(null);
    if (!this.dirty()) {
      this.editing.set(false);
      return;
    }
    this.saving.set(true);
    this.layout
      .save(this.draft())
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.editing.set(false);
          this.toast.success('Dashboard saved');
        },
        error: (err) => this.toast.error(errorMessage(err, 'Couldn’t save your dashboard.')),
      });
  }

  /** Leaving the page while editing keeps the changes, like closing quick settings. */
  private saveOnLeave(): void {
    this.gestures.dispose();
    if (!this.dirty() || this.saving()) return;
    const toast = this.toast;
    this.layout.save(this.draft()).subscribe({
      next: () => toast.success('Dashboard saved'),
      error: (err) => toast.error(errorMessage(err, 'Couldn’t save your dashboard.')),
    });
  }

  /** Closing the tab can't wait for a save, so the browser asks first. */
  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty()) event.preventDefault();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.gestures.cancel()) return;
    if (this.selected()) {
      const inPicker = !!(document.activeElement as Element | null)?.closest('.size-picker');
      this.closePicker(inPicker);
      return;
    }
    if (this.editing() && !this.saving()) this.cancelEdit();
  }

  resetLayout(): void {
    this.animate(() => this.draft.set([...DEFAULT_LAYOUT]));
    this.announcement.set('Dashboard reset to the default tiles.');
  }

  addTile(def: TileDefinition): void {
    this.animate(() => this.draft.update((d) => [...d, { id: def.id, size: def.defaultSize }]));
    this.announcement.set(`${def.title} added at the end.`);
    this.justAdded.set(def.id);
    setTimeout(() => this.justAdded.set(null), 1200);
    afterNextRender(
      () => {
        const el = this.tileElement(def.id);
        el?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'nearest' });
        el?.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }

  removeTile(id: TileId): void {
    if (this.selected() === id) this.selected.set(null);
    const index = this.draft().findIndex((t) => t.id === id);
    this.animate(() => this.draft.update((d) => d.filter((t) => t.id !== id)));
    this.announcement.set(`${tileDefinition(id).title} removed.`);
    // Keep the keyboard nearby: the tile that took its place, or the one before.
    afterNextRender(
      () => {
        const next = this.draft()[index] ?? this.draft()[index - 1];
        if (next) this.tileElement(next.id)?.focus();
      },
      { injector: this.injector },
    );
  }

  setSize(id: TileId, size: TileSize): void {
    if (this.draft().find((t) => t.id === id)?.size === size) return;
    this.animate(() => this.draft.update((d) => d.map((t) => (t.id === id ? { ...t, size } : t))));
    this.announcement.set(`${tileDefinition(id).title}: ${TILE_SIZE_LABELS[size].long}.`);
  }

  private moveTile(id: TileId, to: number, skipAnimation?: TileId): void {
    const from = this.draft().findIndex((t) => t.id === id);
    if (from < 0 || to < 0 || to >= this.draft().length || from === to) return;
    this.animate(
      () =>
        this.draft.update((d) => {
          const next = [...d];
          const [tile] = next.splice(from, 1);
          next.splice(to, 0, tile);
          return next;
        }),
      skipAnimation,
    );
  }

  /** What a tile says to screen readers in edit mode. */
  tileLabel(tile: PlacedTile, index: number): string {
    const def = tileDefinition(tile.id);
    return `${def.title}, ${TILE_SIZE_LABELS[tile.size].long.toLowerCase()}, position ${index + 1} of ${this.draft().length}`;
  }

  /**
   * Keyboard editing on a focused tile: arrows move it, Shift with arrows
   * resizes it, Delete removes it.
   */
  onTileKeydown(tile: PlacedTile, index: number, event: KeyboardEvent): void {
    if (event.target !== event.currentTarget || this.gestures.active) return;
    const { key } = event;
    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      this.toggleSelected(tile.id, true);
      return;
    }
    if (key === 'Delete' || key === 'Backspace') {
      event.preventDefault();
      this.removeTile(tile.id);
      return;
    }
    const forward = key === 'ArrowRight' || key === 'ArrowDown';
    const back = key === 'ArrowLeft' || key === 'ArrowUp';

    if (event.shiftKey && (forward || back)) {
      event.preventDefault();
      const sizes = tileDefinition(tile.id).sizes;
      const next = sizes[sizes.indexOf(tile.size) + (forward ? 1 : -1)];
      if (next) this.setSize(tile.id, next);
      return;
    }

    const last = this.draft().length - 1;
    const to = forward
      ? index + 1
      : back
        ? index - 1
        : key === 'Home'
          ? 0
          : key === 'End'
            ? last
            : null;
    if (to === null) return;
    event.preventDefault();
    if (to < 0 || to > last || to === index) return;
    this.moveTile(tile.id, to);
    this.announcement.set(
      `${tileDefinition(tile.id).title} moved to position ${to + 1} of ${last + 1}.`,
    );
    // Moving the tile re-inserts it in the page, which drops focus; put it back.
    afterNextRender(() => this.tileElement(tile.id)?.focus({ preventScroll: true }), {
      injector: this.injector,
    });
  }

  private tileElement(id: TileId): HTMLElement | null {
    return this.grid()?.nativeElement.querySelector<HTMLElement>(`[data-tile="${id}"]`) ?? null;
  }

  /**
   * Runs a layout change and slides each tile from where it is on screen to its
   * new place. Starting from the on-screen position means a slide that is cut
   * short by the next change carries on smoothly instead of jumping.
   */
  private animate(change: () => void, skip?: TileId): void {
    const grid = this.grid()?.nativeElement;
    if (!grid || reducedMotion() || typeof grid.animate !== 'function') {
      change();
      return;
    }
    const before = new Map<string, DOMRect>();
    grid.querySelectorAll<HTMLElement>('[data-tile]').forEach((el) => {
      before.set(el.dataset['tile']!, el.getBoundingClientRect());
    });
    change();
    afterNextRender(
      {
        write: () => {
          grid.querySelectorAll<HTMLElement>('[data-tile]').forEach((el) => {
            const id = el.dataset['tile']!;
            if (id === skip) return;
            const old = before.get(id);
            el.getAnimations().forEach((a) => a.cancel());
            if (!old) {
              el.animate(
                [
                  { opacity: 0, transform: 'scale(0.92)' },
                  { opacity: 1, transform: 'none' },
                ],
                { duration: 220, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
              );
              return;
            }
            const now = el.getBoundingClientRect();
            const dx = old.left - now.left;
            const dy = old.top - now.top;
            const sx = old.width / now.width;
            const sy = old.height / now.height;
            const resized = Math.abs(sx - 1) > 0.01 || Math.abs(sy - 1) > 0.01;
            if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && !resized) return;
            el.animate(
              [
                {
                  transformOrigin: 'top left',
                  transform: `translate(${dx}px, ${dy}px)${resized ? ` scale(${sx}, ${sy})` : ''}`,
                },
                { transformOrigin: 'top left', transform: 'none' },
              ],
              { duration: 240, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
            );
          });
        },
      },
      { injector: this.injector },
    );
  }

  readonly getFileIcon = getFileIcon;

  /** "<1%" for tiny shares so a real file type never reads as 0%. */
  formatPercent(pct: number): string {
    if (pct <= 0) return '0%';
    return pct < 1 ? '<1%' : `${Math.round(pct)}%`;
  }

  formatSize = formatBytes;
}

function hasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}
