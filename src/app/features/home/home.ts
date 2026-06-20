import { Component, inject, signal, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Files } from '../../core/services/files';
import { FileMetadata } from '../../core/models/file-metadata';
import { FileTable } from '../../shared/file-table/file-table';
import { isPreviewable } from '../../core/utils/file-preview.utils';
import { DatePipe } from '@angular/common';
import { Auth } from '../../core/services/auth';

@Component({
  selector: 'app-home',
  imports: [FileTable, RouterLink, DatePipe],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  private fileService = inject(Files);
  private authService = inject(Auth);
  private router = inject(Router);

  username = signal(this.authService.getTokenPayload()?.sub ?? '');

  recentFiles = signal<FileMetadata[]>([]);
  trashedFiles = signal<FileMetadata[]>([]);
  loadingRecent = signal(true);
  loadingTrashed = signal(true);

  // Will be replaced with a real /stats endpoint later
  totalFiles = signal(0);
  storageUsedBytes = signal(0);
  storageLimitBytes = signal(21_474_836_480); // 20 GB
  filesThisWeek = signal(0);
  starredCount = signal(0);

  storageUsedGB = computed(() => (this.storageUsedBytes() / 1e9).toFixed(1));
  storageLimitGB = computed(() => Math.round(this.storageLimitBytes() / 1e9));
  storagePercent = computed(() =>
    Math.round((this.storageUsedBytes() / this.storageLimitBytes()) * 100),
  );
  storageFreePercent = computed(() => 100 - this.storagePercent());

  // SVG ring: circumference of r=24 circle = 2 * PI * 24
  readonly circumference = 2 * Math.PI * 24;
  ringOffset = computed(() => this.circumference * (1 - this.storagePercent() / 100));

  // Storage breakdown — stub until a /stats endpoint exists
  storageBreakdown = signal([
    { label: 'Documents', bytes: 0, color: '#EF4444', icon: 'picture_as_pdf' },
    { label: 'Images', bytes: 0, color: '#22C55E', icon: 'image' },
    { label: 'Archives', bytes: 0, color: '#F8B84E', icon: 'folder_zip' },
    { label: 'Other', bytes: 0, color: '#818CF8', icon: 'description' },
  ]);

  breakdownWithPercent = computed(() => {
    const total = this.storageUsedBytes();
    return this.storageBreakdown().map((t) => ({
      ...t,
      sizeLabel: this.formatSize(t.bytes),
      percent: total > 0 ? Math.round((t.bytes / total) * 100) : 0,
    }));
  });

  constructor() {
    this.loadRecentFiles();
    this.loadTrashedFiles();
  }

  private loadRecentFiles(): void {
    this.fileService
      .listActive(0)
      .pipe(finalize(() => this.loadingRecent.set(false)))
      .subscribe({
        next: (response) => {
          this.recentFiles.set(response.content.slice(0, 10));
          this.totalFiles.set((response as any).totalElements ?? response.content.length);
        },
      });
  }

  private loadTrashedFiles(): void {
    // TODO: replace with fileService.listTrashed() once wired up
    this.loadingTrashed.set(false);
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
    // TODO: implement once trash service restore method exists
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
}
