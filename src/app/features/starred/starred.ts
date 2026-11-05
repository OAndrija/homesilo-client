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
import { ToastService } from '../../core/services/toast';

@Component({
  selector: 'app-starred',
  imports: [FileTable, SelectionBar, LoadingDelayPipe],
  templateUrl: './starred.html',
})
export class Starred {
  private fileService = inject(Files);
  private fileActions = inject(FileActions);
  private dashboardStore = inject(DashboardStore);
  private toast = inject(ToastService);
  private searchService = inject(Search);

  fileTable = viewChild(FileTable);

  files = signal<FileMetadata[]>([]);
  loading = signal(true);
  loadingMore = signal(false);
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
        error: (err) => this.toast.error(errorMessage(err, 'Search failed.')),
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
        error: (err) => this.toast.error(errorMessage(err, 'Couldn’t load starred files.')),
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
      error: (err) => this.toast.error(errorMessage(err, 'Couldn’t load more files.')),
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
          run: () =>
            this.fileService.restore(file.id).subscribe({
              next: () => this.reloadCurrent(),
              error: (err) => this.toast.error(errorMessage(err, 'Couldn’t undo.')),
            }),
        });
      },
      error: (err) => this.toast.error(errorMessage(err, 'Couldn’t move the file to trash.')),
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
          this.toast.success(`Removed star from “${updated.originalFileName}”`, {
            label: 'Undo',
            run: () =>
              this.fileService.toggleStar(updated.id).subscribe(() => this.reloadCurrent()),
          });
        }
      },
      error: (err) => this.toast.error(errorMessage(err, 'Couldn’t update the star.')),
    });
  }

  openFile(file: FileMetadata): void {
    if (!this.fileActions.open(file)) {
      this.toast.info(`“${file.originalFileName}” can’t be previewed. Download it instead.`, {
        label: 'Download',
        run: () => this.fileActions.download(file),
      });
      this.fileTable()?.flashRowError(file.id);
    }
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
          this.toast.error(errorMessage(err, 'Some files couldn’t be moved to trash.')),
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

  selectedCount(): number {
    return this.fileTable()?.selectedIds().size ?? 0;
  }

  private reloadCurrent(): void {
    const query = this.searchService.query().trim();
    if (query) this.runSearch(query);
    else this.loadStarredFiles();
    this.dashboardStore.silentRefresh();
  }
}
