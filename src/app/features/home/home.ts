import { Component, inject, signal, computed, effect } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Files } from '../../core/services/files';
import { DashboardStore } from '../../core/services/dashboard-store';
import { FileMetadata } from '../../core/models/file-metadata';
import { FileTable } from '../../shared/file-table/file-table';
import { isPreviewable } from '../../core/utils/file-preview.utils';
import { DatePipe } from '@angular/common';
import { Auth } from '../../core/services/auth';

const CATEGORY_META: Record<string, { color: string; icon: string }> = {
  Documents: { color: '#F87171', icon: 'picture_as_pdf' },
  Images: { color: '#A78BFA', icon: 'image' },
  Videos: { color: '#F472B6', icon: 'movie' },
  Archives: { color: '#FACC15', icon: 'folder_zip' },
  Other: { color: '#94A3B8', icon: 'description' },
};

@Component({
  selector: 'app-home',
  imports: [FileTable, RouterLink, DatePipe],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  private fileService = inject(Files);
  private store = inject(DashboardStore);
  private authService = inject(Auth);
  private router = inject(Router);

  username = signal(this.authService.getTokenPayload()?.sub ?? '');

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
  storagePercent = computed(() =>
    Math.round((this.storageUsedBytes() / this.storageLimitBytes()) * 100),
  );
  storageFreePercent = computed(() => 100 - this.storagePercent());

  readonly circumference = 2 * Math.PI * 24;
  ringOffset = computed(() => this.circumference * (1 - this.storagePercent() / 100));

  breakdownWithPercent = computed(() => {
    const total = this.storageUsedBytes();
    const breakdown = this.store.stats()?.storageBreakdown ?? [];
    return breakdown.map((t) => {
      const meta = CATEGORY_META[t.category] ?? CATEGORY_META['Other'];
      return {
        label: t.category,
        color: meta.color,
        icon: meta.icon,
        sizeLabel: this.formatSize(t.bytes),
        percent: total > 0 ? Math.round((t.bytes / total) * 100) : 0,
      };
    });
  });

  constructor() {
    // effect() must be created here (constructor field-initializer context) —
    // calling it later from a method loses the injection context it needs.
    effect(() => {
      // Touching the signal establishes the reactive dependency; the actual
      // values are read via the computed signals above, so this effect body
      // intentionally does nothing else. Kept in case you want side effects
      // later (e.g. logging, analytics) when stats change.
      this.store.stats();
    });

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
    this.fileService.download(file.id).subscribe((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.originalFileName;
      a.click();
      window.URL.revokeObjectURL(url);
    });
  }

  openFile(file: FileMetadata): void {
    if (!isPreviewable(file.contentType)) return;
    this.fileService.preview(file.id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => window.URL.revokeObjectURL(url), 10_000);
      },
    });
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

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
}
