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
import { fileSortParam, loadSort, saveSort, SortState } from '../../core/models/sort';
import { ToastService } from '../../core/services/toast';
import { TableSkeleton } from '../../shared/table-skeleton/table-skeleton';

@Component({
  selector: 'app-starred',
  imports: [FileTable, SelectionBar, LoadingDelayPipe, RouterLink, TableSkeleton],
  templateUrl: './starred.html',
  styleUrl: './starred.css',
})
export class Starred {
  private fileService = inject(Files);
  private fileActions = inject(FileActions);
  private dashboardStore = inject(DashboardStore);
  private searchService = inject(Search);
  private toast = inject(ToastService);

  fileTable = viewChild(FileTable);

  files = signal<FileMetadata[]>([]);
  loading = signal(true);
  loadingMore = signal(false);
  errorMessage = signal('');
  currentPage = signal(0);
  hasMore = signal(false);
  sort = signal<SortState>(loadSort('starred'));

  isSearching = computed(() => this.searchService.query().trim().length > 0);
  searchText = computed(() => this.searchService.query().trim());

  clearSearch(): void {
    this.searchService.clear();
  }

  constructor() {
    effect(() => {
      const query = this.searchService.query().trim();
      this.sort(); // reload when the sort changes
      this.currentPage.set(0);
      if (query === '') {
        this.loadStarredFiles();
      } else {
        this.runSearch(query);
      }
    });
  }

  onSortChange(sort: SortState): void {
    this.sort.set(sort);
    saveSort('starred', sort);
  }

  private get sortParam(): string {
    return fileSortParam(this.sort());
  }

  runSearch(query: string): void {
    this.loading.set(true);
    this.fileService
      .searchStarred(query, 0, 50, this.sortParam)
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
      .listStarred(0, 50, this.sortParam)
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
        ? this.fileService.listStarred(nextPage, 50, this.sortParam)
        : this.fileService.searchStarred(query, nextPage, 50, this.sortParam);
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
        this.toast.success(`Moved “${file.originalFileName}” to trash`, {
          label: 'Undo',
          run: () => this.restore([file.id]),
        });
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
        if (!updated.starred) {
          this.toast.success(`Removed “${updated.originalFileName}” from Starred`, {
            label: 'Undo',
            run: () =>
              this.fileService.toggleStar(updated.id).subscribe({
                next: () => this.reloadCurrent(),
                error: (err) => this.toast.error(errorMessage(err, 'Couldn’t restore the star.')),
              }),
          });
        }
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
        complete: () => {
          const n = selected.length;
          this.toast.success(`Moved ${n} file${n === 1 ? '' : 's'} to trash`, {
            label: 'Undo',
            run: () => this.restore(selected.map((f) => f.id)),
          });
        },
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

  /** Undo for "move to trash": restores the files, then reloads the list. */
  private restore(fileIds: string[]): void {
    from(fileIds)
      .pipe(
        concatMap((id) => this.fileService.restore(id)),
        finalize(() => {
          this.reloadCurrent();
          this.dashboardStore.refresh();
        }),
      )
      .subscribe({
        error: (err) => this.toast.error(errorMessage(err, 'Couldn’t restore everything.')),
      });
  }

  private reloadCurrent(): void {
    const query = this.searchService.query().trim();
    if (query) this.runSearch(query);
    else this.loadStarredFiles();
  }

  private getSelectedFiles(): FileMetadata[] {
    const ids = this.fileTable()?.selectedIds() ?? new Set();
    return this.files().filter((f) => ids.has(f.id));
  }
}
