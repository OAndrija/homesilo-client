import { RouterLink } from '@angular/router';
import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { Files } from '../../core/services/files';
import { DashboardStore } from '../../core/services/dashboard-store';
import { Search } from '../../core/services/search';
import { FileMetadata } from '../../core/models/file-metadata';
import { concatMap, finalize, from } from 'rxjs';
import { FileTable } from '../../shared/file-table/file-table';
import { SelectionBar } from '../../shared/selection-bar/selection-bar';
import { LoadingDelayPipe } from '../../shared/pipes/loading-delay';
import { FileActions } from '../../core/services/file-actions';
import { errorMessage } from '../../core/http/http-error';

@Component({
  selector: 'app-starred',
  imports: [FileTable, SelectionBar, LoadingDelayPipe, RouterLink],
  templateUrl: './starred.html',
  styleUrl: './starred.css',
})
export class Starred {
  private fileService = inject(Files);
  private fileActions = inject(FileActions);
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
  searchText = computed(() => this.searchService.query().trim());

  clearSearch(): void {
    this.searchService.clear();
  }

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
        error: (err) => this.errorMessage.set(errorMessage(err, 'Search failed.')),
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
        error: (err) => this.errorMessage.set(errorMessage(err, 'Failed to load starred files.')),
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
      error: (err) =>
        this.errorMessage.set(errorMessage(err, 'Failed to load more starred files.')),
    });
  }

  downloadFile(file: FileMetadata): void {
    this.fileActions.download(file);
  }

  trashFile(file: FileMetadata): void {
    this.fileService.trash(file.id).subscribe({
      next: () => {
        this.files.update((files) => files.filter((f) => f.id !== file.id));
        this.dashboardStore.refresh();
      },
      error: (err) => this.errorMessage.set(errorMessage(err, 'Failed to move file to trash.')),
    });
  }

  /** Unstarring removes the file from this view. */
  toggleStar(file: FileMetadata): void {
    this.fileService.toggleStar(file.id).subscribe({
      next: (updated) => {
        this.files.update((files) =>
          updated.starred
            ? files.map((f) => (f.id === updated.id ? updated : f))
            : files.filter((f) => f.id !== updated.id),
        );
        this.dashboardStore.silentRefresh();
      },
      error: (err) => this.errorMessage.set(errorMessage(err, 'Failed to update star.')),
    });
  }

  openFile(file: FileMetadata): void {
    this.fileActions.open(file, this.files());
  }

  onDownloadAll(): void {
    this.fileActions.downloadSelection(this.getSelectedFiles());
  }

  onTrashAll(): void {
    const selected = this.getSelectedFiles();
    if (selected.length === 0) return;
    from(selected)
      .pipe(
        concatMap((file) => this.fileService.trash(file.id)),
        finalize(() => this.dashboardStore.refresh()),
      )
      .subscribe({
        next: (trashed) => this.files.update((files) => files.filter((f) => f.id !== trashed.id)),
        error: (err) =>
          this.errorMessage.set(errorMessage(err, 'Some files could not be moved to trash.')),
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
        this.files.update((files) =>
          updated.starred
            ? files.map((f) => (f.id === updated.id ? updated : f))
            : files.filter((f) => f.id !== updated.id),
        );
      });
  }

  private getSelectedFiles(): FileMetadata[] {
    const ids = this.fileTable()?.selectedIds() ?? new Set();
    return this.files().filter((f) => ids.has(f.id));
  }
}
