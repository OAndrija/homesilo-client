import { Component, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Files } from '../../core/services/files';
import { DashboardStore } from '../../core/services/dashboard-store';
import { FileMetadata } from '../../core/models/file-metadata';
import { FileTable } from '../../shared/file-table/file-table';
import { DatePipe } from '@angular/common';
import { Auth } from '../../core/services/auth';
import { LoadingDelayPipe } from '../../shared/pipes/loading-delay';
import { FileActions } from '../../core/services/file-actions';
import { formatBytes } from '../../core/utils/format';

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
  imports: [FileTable, RouterLink, DatePipe, LoadingDelayPipe],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  private fileService = inject(Files);
  private store = inject(DashboardStore);
  private authService = inject(Auth);
  private fileActions = inject(FileActions);

  username = computed(() => this.authService.user()?.username ?? '');

  recentFiles = signal<FileMetadata[]>([]);
  loadingRecent = signal(true);

  // Derived straight from the store — no local copies that can drift out of sync.
  totalFiles = computed(() => this.store.stats()?.totalFiles ?? 0);
  filesThisWeek = computed(() => this.store.stats()?.filesThisWeek ?? 0);
  storageUsedBytes = computed(() => this.store.stats()?.storageUsedBytes ?? 0);
  storageLimitBytes = computed(() => this.store.stats()?.storageQuotaBytes ?? 1);
  trashedFiles = computed(() => this.store.stats()?.recentlyTrashed ?? []);
  loadingTrashed = computed(() => this.store.loading());

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

  // ── Silo geometry (must match the SVG in home.html) ──
  readonly siloX = 40;
  readonly siloWidth = 100;
  readonly siloTop = 103;
  readonly siloBottom = 284;
  readonly siloHeight = this.siloBottom - this.siloTop;
  /** Four panel columns, shaded dark to light like the logo. */
  readonly siloColumns = [0, 1, 2, 3].map((i) => ({
    x: this.siloX + i * 25,
    tone: `col-${i + 1}`,
  }));
  /** Horizontal panel seams. */
  readonly siloRows = [1, 2, 3].map((i) => this.siloTop + (this.siloHeight * i) / 4);

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

  /** Top of the green fill; any usage at all shows at least a sliver. */
  siloFillY = computed(() => {
    const used = this.storageUsedBytes();
    const limit = this.storageLimitBytes();
    if (used <= 0 || limit <= 0) return this.siloBottom;
    const height = Math.max(Math.min(used / limit, 1) * this.siloHeight, 3);
    return this.siloBottom - height;
  });

  constructor() {
    this.store.ensureLoaded();
    this.loadRecentFiles();
  }

  private loadRecentFiles(): void {
    this.fileService
      .listRecentlyUploadedActive(0)
      .pipe(finalize(() => this.loadingRecent.set(false)))
      .subscribe({
        next: (response) => {
          this.recentFiles.set(response.content.slice(0, 10));
        },
      });
  }

  downloadFile(file: FileMetadata): void {
    this.fileActions.download(file);
  }

  openFile(file: FileMetadata): void {
    this.fileActions.open(file);
  }

  restoreFile(file: FileMetadata): void {
    this.fileService.restore(file.id).subscribe(() => {
      // Restoring moves the file back into the active/non-trashed count,
      // which changes storageUsedBytes, totalFiles, and recentlyTrashed —
      // refresh the store so every subscriber (sidebar included) updates.
      this.store.silentRefresh();
      this.loadRecentFiles();
    });
  }

  /** "<1%" for tiny shares so a real file type never reads as 0%. */
  formatPercent(pct: number): string {
    if (pct <= 0) return '0%';
    return pct < 1 ? '<1%' : `${Math.round(pct)}%`;
  }

  formatSize = formatBytes;
}
