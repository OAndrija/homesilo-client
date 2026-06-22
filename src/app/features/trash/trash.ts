import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { concatMap, finalize, from } from 'rxjs';
import { Files } from '../../core/services/files';
import { FileMetadata } from '../../core/models/file-metadata';
import { FileTable } from '../../shared/file-table/file-table';
import { SelectionBar } from '../../shared/selection-bar/selection-bar';
import { Search } from '../../core/services/search';
import { DashboardStore } from '../../core/services/dashboard-store';
import { LoadingDelayPipe } from '../../shared/pipes/loading-delay';

@Component({
  selector: 'app-trash',
  imports: [FileTable, SelectionBar, LoadingDelayPipe],
  templateUrl: './trash.html',
  styleUrl: './trash.css',
})
export class Trash {
  private fileService = inject(Files);
  private searchService = inject(Search);
  private dashboardStore = inject(DashboardStore);

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
        this.loadTrashedFiles();
      } else {
        this.runSearch(query);
      }
    });
  }

  runSearch(query: string): void {
    this.loading.set(true);
    this.fileService
      .searchTrashed(query, 0)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          this.files.set(response.content);
          this.hasMore.set(!response.last);
        },
        error: () => this.errorMessage.set('Search failed.'),
      });
  }

  loadTrashedFiles(): void {
    this.loading.set(true);
    this.currentPage.set(0);
    this.fileService
      .listTrashed(0)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          this.files.set(response.content);
          this.hasMore.set(!response.last);
        },
        error: () => this.errorMessage.set('Failed to load trashed files.'),
      });
  }

  loadMore(): void {
    const nextPage = this.currentPage() + 1;
    const query = this.searchService.query().trim();
    this.loadingMore.set(true);
    const request$ =
      query === ''
        ? this.fileService.listTrashed(nextPage)
        : this.fileService.searchTrashed(query, nextPage);
    request$.pipe(finalize(() => this.loadingMore.set(false))).subscribe({
      next: (response) => {
        this.files.update((files) => [...files, ...response.content]);
        this.currentPage.set(nextPage);
        this.hasMore.set(!response.last);
      },
      error: () => this.errorMessage.set('Failed to load more trashed files.'),
    });
  }

  deleteFile(file: FileMetadata): void {
    if (!confirm(`Permanently delete "${file.originalFileName}"?`)) return;
    this.fileService.deletePermanently(file.id).subscribe({
      next: () => {
        this.files.update((files) => files.filter((f) => f.id !== file.id));
        this.dashboardStore.refresh();
      },
      error: () => this.errorMessage.set('Failed to delete file.'),
    });
  }

  restoreFile(file: FileMetadata): void {
    this.fileService.restore(file.id).subscribe(() => {
      this.files.update((files) => files.filter((f) => f.id !== file.id));
      this.dashboardStore.refresh();
    });
  }

  onRestoreAll(): void {
    const selected = this.getSelectedFiles();
    if (selected.length === 0) return;
    from(selected)
      .pipe(
        concatMap((file) => this.fileService.restore(file.id)),
        finalize(() => this.dashboardStore.refresh()),
      )
      .subscribe(() => {
        const ids = new Set(selected.map((f) => f.id));
        this.files.update((files) => files.filter((f) => !ids.has(f.id)));
      });
  }

  onDeleteForeverAll(): void {
    const selected = this.getSelectedFiles();
    if (selected.length === 0) return;
    if (
      !confirm(
        `Permanently delete ${selected.length} file${selected.length !== 1 ? 's' : ''}? This cannot be undone.`,
      )
    )
      return;
    from(selected)
      .pipe(
        concatMap((file) => this.fileService.deletePermanently(file.id)),
        finalize(() => this.dashboardStore.refresh()),
      )
      .subscribe(() => {
        const ids = new Set(selected.map((f) => f.id));
        this.files.update((files) => files.filter((f) => !ids.has(f.id)));
      });
  }

  private getSelectedFiles(): FileMetadata[] {
    const ids = this.fileTable()?.selectedIds() ?? new Set();
    return this.files().filter((f) => ids.has(f.id));
  }
}
