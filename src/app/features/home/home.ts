import { Component, inject, signal, computed } from '@angular/core';
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
  imports: [FileTable, RouterLink, FriendlyDatePipe],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  private fileService = inject(Files);
  private folderService = inject(Folders);
  private uploads = inject(UploadService);
  private store = inject(DashboardStore);
  private authService = inject(Auth);
  private fileActions = inject(FileActions);

  username = computed(() => this.authService.user()?.username ?? '');

  recentFiles = signal<FileMetadata[]>([]);
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

  constructor() {
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
      .listRecentlyUploadedActive(0)
      .pipe(finalize(() => this.loadingRecent.set(false)))
      .subscribe({
        next: (response) => this.recentFiles.set(response.content.slice(0, 8)),
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
        next: (contents) => this.folders.set(contents.subfolders.slice(0, 8)),
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
