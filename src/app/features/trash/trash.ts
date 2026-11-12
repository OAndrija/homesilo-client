import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { concatMap, finalize, from, forkJoin } from 'rxjs';
import { errorMessage } from '../../core/http/http-error';
import { TrashApi } from '../../core/services/trash';
import { Files } from '../../core/services/files';
import { Folders } from '../../core/services/folders';
import { FileMetadata } from '../../core/models/file-metadata';
import { Folder } from '../../core/models/folder';
import { FileTable } from '../../shared/file-table/file-table';
import { SelectionBar } from '../../shared/selection-bar/selection-bar';
import { Search } from '../../core/services/search';
import { DashboardStore } from '../../core/services/dashboard-store';
import { LoadingDelayPipe } from '../../shared/pipes/loading-delay';
import { fileSortParam, loadSort, saveSort, SortState, sortFolders } from '../../core/models/sort';
import { ToastService } from '../../core/services/toast';
import { TableSkeleton } from '../../shared/table-skeleton/table-skeleton';
import {
  ConfirmDeleteDialog,
  DeleteTarget,
} from '../../shared/confirm-delete-dialog/confirm-delete-dialog';

@Component({
  selector: 'app-trash',
  imports: [FileTable, SelectionBar, LoadingDelayPipe, ConfirmDeleteDialog, TableSkeleton],
  templateUrl: './trash.html',
  styleUrl: './trash.css',
})
export class Trash {
  private fileService = inject(Files);
  private folderService = inject(Folders);
  private trashApi = inject(TrashApi);
  private searchService = inject(Search);
  private toast = inject(ToastService);
  private dashboardStore = inject(DashboardStore);

  fileTable = viewChild(FileTable);

  files = signal<FileMetadata[]>([]);
  folders = signal<Folder[]>([]);
  loading = signal(true);
  loadingMore = signal(false);
  errorMessage = signal('');
  currentPage = signal(0);
  hasMore = signal(false);
  sort = signal<SortState>(loadSort('trash'));
  /** Folders aren't paged here, so they're sorted in the browser (by deletion time for "date"). */
  sortedFolders = computed(() => sortFolders(this.folders(), this.sort(), 'trashedAt'));

  isSearching = computed(() => this.searchService.query().trim().length > 0);
  searchText = computed(() => this.searchService.query().trim());

  clearSearch(): void {
    this.searchService.clear();
  }

  totalCount = computed(() => this.files().length + this.folders().length);
  retentionDays = computed(() => this.dashboardStore.stats()?.trashRetentionDays ?? 0);

  pendingDelete = signal<DeleteTarget | null>(null);
  private pendingDeleteCallback = signal<(() => void) | null>(null);

  constructor() {
    this.dashboardStore.ensureLoaded();
    effect(() => {
      const query = this.searchService.query().trim();
      this.sort(); // reload when the sort changes
      this.currentPage.set(0);
      if (query === '') {
        this.loadTrashedItems();
      } else {
        this.runSearch(query);
      }
    });
  }

  // ── Load ──────────────────────────────────────────────────────

  private loadTrashedItems(): void {
    this.loading.set(true);
    forkJoin({
      files: this.fileService.listTrashed(0, 50, this.sortParam),
      folders: this.folderService.listTrashed(0),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ files, folders }) => {
          this.files.set(files.content);
          this.folders.set(folders.content);
          this.hasMore.set(!files.last);
        },
        error: (err) => this.errorMessage.set(errorMessage(err, 'Failed to load trash.')),
      });
  }

  onSortChange(sort: SortState): void {
    this.sort.set(sort);
    saveSort('trash', sort);
  }

  private get sortParam(): string {
    return fileSortParam(this.sort(), 'trashedAt');
  }

  runSearch(query: string): void {
    this.loading.set(true);
    this.folders.set([]); // search only covers files for now
    this.fileService
      .searchTrashed(query, 0, 50, this.sortParam)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          this.files.set(response.content);
          this.hasMore.set(!response.last);
        },
        error: (err) => this.errorMessage.set(errorMessage(err, 'Search failed.')),
      });
  }

  loadMore(): void {
    const nextPage = this.currentPage() + 1;
    const query = this.searchService.query().trim();
    this.loadingMore.set(true);
    const request$ =
      query === ''
        ? this.fileService.listTrashed(nextPage, 50, this.sortParam)
        : this.fileService.searchTrashed(query, nextPage, 50, this.sortParam);
    request$.pipe(finalize(() => this.loadingMore.set(false))).subscribe({
      next: (response) => {
        this.files.update((files) => [...files, ...response.content]);
        this.currentPage.set(nextPage);
        this.hasMore.set(!response.last);
      },
      error: (err) => this.errorMessage.set(errorMessage(err, 'Failed to load more.')),
    });
  }

  // ── File actions ──────────────────────────────────────────────

  deleteFile(file: FileMetadata): void {
    this.requestDelete({ type: 'file', name: file.originalFileName }, () => {
      this.fileService.deletePermanently(file.id).subscribe({
        next: () => {
          this.files.update((files) => files.filter((f) => f.id !== file.id));
          this.dashboardStore.refresh();
          this.toast.success(`Deleted “${file.originalFileName}” forever`);
        },
        error: (err) => this.errorMessage.set(errorMessage(err, 'Failed to delete file.')),
      });
    });
  }

  restoreFile(file: FileMetadata): void {
    this.fileService.restore(file.id).subscribe({
      next: () => {
        this.files.update((files) => files.filter((f) => f.id !== file.id));
        this.dashboardStore.refresh();
        this.toast.success(
          file.folderName
            ? `Restored “${file.originalFileName}” to ${file.folderName}`
            : `Restored “${file.originalFileName}”`,
        );
      },
      error: (err) => this.errorMessage.set(errorMessage(err, 'Failed to restore file.')),
    });
  }

  // ── Folder actions ────────────────────────────────────────────

  restoreFolder(folder: Folder): void {
    this.folderService.restoreFolder(folder.id).subscribe({
      next: () => {
        this.folders.update((folders) => folders.filter((f) => f.id !== folder.id));
        this.dashboardStore.refresh();
        this.toast.success(`Restored “${folder.name}”`);
      },
      error: (err) => this.errorMessage.set(errorMessage(err, 'Failed to restore folder.')),
    });
  }

  deleteFolderForever(folder: Folder): void {
    this.requestDelete({ type: 'folder', name: folder.name }, () => {
      this.folderService.deleteFolder(folder.id).subscribe({
        next: () => {
          this.folders.update((folders) => folders.filter((f) => f.id !== folder.id));
          this.dashboardStore.refresh();
          this.toast.success(`Deleted “${folder.name}” forever`);
        },
        error: (err) => this.errorMessage.set(errorMessage(err, 'Failed to delete folder.')),
      });
    });
  }

  // ── Bulk actions ──────────────────────────────────────────────

  onRestoreAll(): void {
    const selectedFiles = this.getSelectedFiles();
    const selectedFolders = this.getSelectedFolders();
    if (selectedFiles.length === 0 && selectedFolders.length === 0) return;

    from([
      ...selectedFiles.map((f) => this.fileService.restore(f.id)),
      ...selectedFolders.map((f) => this.folderService.restoreFolder(f.id)),
    ])
      .pipe(
        concatMap((req) => req),
        finalize(() => {
          this.dashboardStore.refresh();
          this.loadTrashedItems();
        }),
      )
      .subscribe({
        error: (err) =>
          this.errorMessage.set(errorMessage(err, 'Some items could not be restored.')),
        complete: () => {
          const n = selectedFiles.length + selectedFolders.length;
          this.toast.success(`Restored ${n} item${n === 1 ? '' : 's'}`);
        },
      });
  }

  onDeleteForeverAll(): void {
    const selectedFiles = this.getSelectedFiles();
    const selectedFolders = this.getSelectedFolders();
    const total = selectedFiles.length + selectedFolders.length;
    if (total === 0) return;

    this.requestDelete({ type: 'bulk', count: total }, () => {
      from([
        ...selectedFiles.map((f) => this.fileService.deletePermanently(f.id)),
        ...selectedFolders.map((f) => this.folderService.deleteFolder(f.id)),
      ])
        .pipe(
          concatMap((req) => req),
          finalize(() => {
            this.dashboardStore.refresh();
            this.loadTrashedItems();
          }),
        )
        .subscribe({
          error: (err) =>
            this.errorMessage.set(errorMessage(err, 'Some items could not be deleted.')),
          complete: () =>
            this.toast.success(`Deleted ${total} item${total === 1 ? '' : 's'} forever`),
        });
    });
  }

  emptyTrash(): void {
    const total = this.totalCount();
    if (total === 0) return;
    this.requestDelete({ type: 'emptyTrash', count: total }, () => {
      this.trashApi
        .empty()
        .pipe(finalize(() => this.dashboardStore.refresh()))
        .subscribe({
          next: () => {
            this.files.set([]);
            this.folders.set([]);
            this.hasMore.set(false);
            this.toast.success('Trash emptied');
          },
          error: (err) => this.errorMessage.set(errorMessage(err, 'Failed to empty trash.')),
        });
    });
  }

  private getSelectedFiles(): FileMetadata[] {
    const ids = this.fileTable()?.selectedIds() ?? new Set();
    return this.files().filter((f) => ids.has(f.id));
  }

  private getSelectedFolders(): Folder[] {
    const ids = this.fileTable()?.selectedFolderIds() ?? new Set();
    return this.folders().filter((f) => ids.has(f.id));
  }

  private requestDelete(target: DeleteTarget, callback: () => void): void {
    this.pendingDelete.set(target);
    this.pendingDeleteCallback.set(callback);
  }

  onDeleteConfirmed(): void {
    this.pendingDeleteCallback()?.();
    this.pendingDelete.set(null);
    this.pendingDeleteCallback.set(null);
  }

  onDeleteCancelled(): void {
    this.pendingDelete.set(null);
    this.pendingDeleteCallback.set(null);
  }
}
