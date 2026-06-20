import { Component, inject, signal, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Files } from '../../core/services/files';
import { Dashboard } from '../../core/services/dashboard';
import { FileMetadata } from '../../core/models/file-metadata';
import { FileTable } from '../../shared/file-table/file-table';
import { isPreviewable } from '../../core/utils/file-preview.utils';
import { DatePipe } from '@angular/common';
import { Auth } from '../../core/services/auth';

const CATEGORY_META: Record<string, { color: string; icon: string }> = {
  Documents: { color: '#EF4444', icon: 'picture_as_pdf' },
  Images: { color: '#22C55E', icon: 'image' },
  Videos: { color: '#818CF8', icon: 'movie' },
  Archives: { color: '#F8B84E', icon: 'folder_zip' },
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
  private dashboardService = inject(Dashboard);
  private authService = inject(Auth);
  private router = inject(Router);

  username = signal(this.authService.getTokenPayload()?.sub ?? '');

  recentFiles = signal<FileMetadata[]>([]);
  trashedFiles = signal<FileMetadata[]>([]);
  loadingRecent = signal(true);
  loadingTrashed = signal(true);

  totalFiles = signal(0);
  storageUsedBytes = signal(0);
  storageLimitBytes = signal(1);
  filesThisWeek = signal(0);
  starredCount = signal(0);

  storageBreakdownRaw = signal<{ category: string; bytes: number }[]>([]);

  storageUsedGB = computed(() => (this.storageUsedBytes() / 1e9).toFixed(1));
  storageLimitGB = computed(() => Math.round(this.storageLimitBytes() / 1e9));
  storagePercent = computed(() =>
    Math.round((this.storageUsedBytes() / this.storageLimitBytes()) * 100),
  );
  storageFreePercent = computed(() => 100 - this.storagePercent());

  readonly circumference = 2 * Math.PI * 24;
  ringOffset = computed(() => this.circumference * (1 - this.storagePercent() / 100));

  breakdownWithPercent = computed(() => {
    const total = this.storageUsedBytes();
    return this.storageBreakdownRaw().map((t) => {
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
    this.loadDashboardStats();
    this.loadRecentFiles();
  }

  private loadDashboardStats(): void {
    this.loadingTrashed.set(true);
    this.dashboardService
      .getStats()
      .pipe(finalize(() => this.loadingTrashed.set(false)))
      .subscribe({
        next: (stats) => {
          this.storageUsedBytes.set(stats.storageUsedBytes);
          this.storageLimitBytes.set(stats.storageQuotaBytes);
          this.totalFiles.set(stats.totalFiles);
          this.filesThisWeek.set(stats.filesThisWeek);
          this.storageBreakdownRaw.set(stats.storageBreakdown);
          this.trashedFiles.set(stats.recentlyTrashed);
        },
      });
  }

  private loadRecentFiles(): void {
    this.fileService
      .listActive(0)
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
      this.trashedFiles.update((files) => files.filter((f) => f.id !== file.id));
    });
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
}
