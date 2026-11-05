import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { concatMap, finalize, from, forkJoin } from 'rxjs';
import { errorMessage } from '../../core/http/http-error';
import { ToastService } from '../../core/services/toast';
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
import {
  ConfirmDeleteDialog,
  DeleteTarget,
} from '../../shared/confirm-delete-dialog/confirm-delete-dialog';

@Component({
  selector: 'app-trash',
  imports: [FileTable, SelectionBar, LoadingDelayPipe, ConfirmDeleteDialog],
  templateUrl: './trash.html',
})
export class Trash {
  private fileService = inject(Files);
  private folderService = inject(Folders);
  private trashApi = inject(TrashApi);
  private searchService = inject(Search);
  private dashboardStore = inject(DashboardStore);
  private toast = inject(ToastService);

  fileTable = viewChild(FileTable);

  files = signal<FileMetadata[]>([]);
  folders = signal<Folder[]>([]);
  loading = signal(true);
  loadingMore = signal(false);
  currentPage = signal(0);
  hasMore = signal(false);

  isSearching = computed(() => this.searchService.query().trim().length > 0);

  totalCount = computed(() => this.files().length + this.folders().length);
  retentionDays = computed(() => this.dashboardStore.stats()?.trashRetentionDays ?? 0);

  pendingDelete = signal<DeleteTarget | null>(null);
  private pendingDeleteCallback = signal<(() => void) | null>(null);

  constructor() {
    this.dashboardStore.ensureLoaded();
    effect(() => {
      const query = this.searchService.query().trim();
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
      files: this.fileService.listTrashed(0),
      folders: this.folderService.listTrashed(0),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ files, folders }) => {
          this.files.set(files.content);
          this.folders.set(folders.content);
          this.hasMore.set(!files.last);
        },
        error: (err) => this.toast.error(errorMessage(err, 'Couldn’t load the trash.')),
      });
  }

  runSearch(query: string): void {
    this.loading.set(true);
    this.folders.set([]); // search only covers files for now
    this.fileService
      .searchTrashed(query, 0)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          this.files.set(response.content);
          this.hasMore.set(!response.last);
        },
        error: (err) => this.toast.error(errorMessage(err, 'Search failed.')),
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
      error: (err) => this.toast.error(errorMessage(err, 'Couldn’t load more items.')),
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
        error: (err) => this.toast.error(errorMessage(err, 'Couldn’t delete the file.')),
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
      error: (err) => this.toast.error(errorMessage(err, 'Couldn’t restore the file.')),
    });
  }

  // ── Folder actions ────────────────────────────────────────────

  restoreFolder(folder: Folder): void {
    this.folderService.restoreFolder(folder.id).subscribe({
      next: (restored) => {
        this.folders.update((folders) => folders.filter((f) => f.id !== folder.id));
        this.dashboardStore.refresh();
        this.toast.success(`Restored “${restored.name}”`);
      },
      error: (err) => this.toast.error(errorMessage(err, 'Couldn’t restore the folder.')),
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
        error: (err) => this.toast.error(errorMessage(err, 'Couldn’t delete the folder.')),
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
        error: (err) => this.toast.error(errorMessage(err, 'Some items couldn’t be restored.')),
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
          error: (err) => this.toast.error(errorMessage(err, 'Some items couldn’t be deleted.')),
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
          next: (result) => {
            this.files.set([]);
            this.folders.set([]);
            this.hasMore.set(false);
            const count = result.files + result.folders;
            this.toast.success(`Deleted ${count} item${count !== 1 ? 's' : ''} forever`);
          },
          error: (err) => this.toast.error(errorMessage(err, 'Couldn’t empty the trash.')),
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

  selectedCount(): number {
    return (
      (this.fileTable()?.selectedIds().size ?? 0) +
      (this.fileTable()?.selectedFolderIds().size ?? 0)
    );
  }
}
