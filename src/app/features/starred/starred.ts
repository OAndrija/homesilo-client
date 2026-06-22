import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { Files } from '../../core/services/files';
import { DashboardStore } from '../../core/services/dashboard-store';
import { Search } from '../../core/services/search';
import { FileMetadata } from '../../core/models/file-metadata';
import { concatMap, finalize, from } from 'rxjs';
import { FileTable } from '../../shared/file-table/file-table';
import { SelectionBar } from '../../shared/selection-bar/selection-bar';
import { isPreviewable } from '../../core/utils/file-preview.utils';
import { LoadingDelayPipe } from '../../shared/pipes/loading-delay';

@Component({
  selector: 'app-starred',
  imports: [FileTable, SelectionBar, LoadingDelayPipe],
  templateUrl: './starred.html',
  styleUrl: './starred.css',
})
export class Starred {
  private fileService = inject(Files);
  private dashboardStore = inject(DashboardStore);
  private searchService = inject(Search);

  fileTable = viewChild(FileTable);

  files = signal<FileMetadata[]>([]);
  loading = signal(true);
  loadingMore = signal(false);
  errorMessage = signal('');
  currentPage = signal(0);
  hasMore = signal(false);

  isSearching = computed(() => this.searchService.query().trim().length > 0);

  constructor() {
    effect(() => {
      const query = this.searchService.query().trim();
      this.currentPage.set(0);
      if (query === '') {
        this.loadStarredFiles();
      } else {
        this.runSearch(query);
      }
    });
  }

  runSearch(query: string): void {
    this.loading.set(true);
    this.fileService
      .searchStarred(query, 0)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          this.files.set(response.content);
          this.hasMore.set(!response.last);
        },
        error: () => this.errorMessage.set('Search failed.'),
      });
  }

  loadStarredFiles(): void {
    this.loading.set(true);
    this.currentPage.set(0);
    this.fileService
      .listStarred(0)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          this.files.set(response.content);
          this.hasMore.set(!response.last);
        },
        error: () => this.errorMessage.set('Failed to load starred files.'),
      });
  }

  loadMore(): void {
    const nextPage = this.currentPage() + 1;
    const query = this.searchService.query().trim();
    this.loadingMore.set(true);
    const request$ =
      query === ''
        ? this.fileService.listStarred(nextPage)
        : this.fileService.searchStarred(query, nextPage);
    request$.pipe(finalize(() => this.loadingMore.set(false))).subscribe({
      next: (response) => {
        this.files.update((files) => [...files, ...response.content]);
        this.currentPage.set(nextPage);
        this.hasMore.set(!response.last);
      },
      error: () => this.errorMessage.set('Failed to load more starred files.'),
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

  trashFile(file: FileMetadata): void {
    this.fileService.trash(file.id).subscribe(() => {
      this.files.update((files) => files.filter((f) => f.id !== file.id));
      this.dashboardStore.refresh();
    });
  }

  toggleStar(file: FileMetadata): void {
    this.fileService.toggleStar(file.id).subscribe((updated) => {
      this.files.update((files) => files.map((f) => (f.id === updated.id ? updated : f)));
      this.dashboardStore.silentRefresh();
    });
  }

  openFile(file: FileMetadata): void {
    if (!isPreviewable(file.contentType)) {
      this.errorMessage.set(
        `Preview not available for "${file.originalFileName}". Use download instead.`,
      );
      this.fileTable()?.flashRowError(file.id);
      return;
    }
    this.fileService.preview(file.id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => window.URL.revokeObjectURL(url), 10000);
      },
      error: () => {
        this.errorMessage.set('Failed to open file.');
        this.fileTable()?.flashRowError(file.id);
      },
    });
  }

  onDownloadAll(): void {
    const selected = this.getSelectedFiles();
    if (selected.length === 0) return;
    if (selected.length === 1) {
      this.downloadFile(selected[0]);
      return;
    }
    this.fileService.downloadZip(selected.map((f) => f.id)).subscribe((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'homesilo-files.zip';
      a.click();
      window.URL.revokeObjectURL(url);
    });
  }

  onTrashAll(): void {
    const selected = this.getSelectedFiles();
    if (selected.length === 0) return;
    from(selected)
      .pipe(
        concatMap((file) => this.fileService.trash(file.id)),
        finalize(() => this.dashboardStore.refresh()),
      )
      .subscribe(() => {
        const ids = new Set(selected.map((f) => f.id));
        this.files.update((files) => files.filter((f) => !ids.has(f.id)));
      });
  }

  onStarAll(): void {
    const selected = this.getSelectedFiles();
    if (selected.length === 0) return;
    from(selected)
      .pipe(
        concatMap((file) => this.fileService.toggleStar(file.id)),
        finalize(() => this.dashboardStore.silentRefresh()),
      )
      .subscribe((updated) => {
        this.files.update((files) => files.map((f) => (f.id === updated.id ? updated : f)));
      });
  }

  private getSelectedFiles(): FileMetadata[] {
    const ids = this.fileTable()?.selectedIds() ?? new Set();
    return this.files().filter((f) => ids.has(f.id));
  }
}
