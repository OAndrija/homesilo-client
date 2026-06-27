import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { catchError, concatMap, finalize, from, forkJoin, of } from 'rxjs';
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
  styleUrl: './trash.css',
})
export class Trash {
  private fileService = inject(Files);
  private folderService = inject(Folders);
  private searchService = inject(Search);
  private dashboardStore = inject(DashboardStore);

  fileTable = viewChild(FileTable);

  files = signal<FileMetadata[]>([]);
  folders = signal<Folder[]>([]);
  loading = signal(true);
  loadingMore = signal(false);
  errorMessage = signal('');
  currentPage = signal(0);
  hasMore = signal(false);

  isSearching = computed(() => this.searchService.query().trim().length > 0);

  totalCount = computed(() => this.files().length + this.folders().length);

  pendingDelete = signal<DeleteTarget | null>(null);
  private pendingDeleteCallback = signal<(() => void) | null>(null);

  constructor() {
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
        error: (err) => {
          console.error('Trash load error:', err);
          this.errorMessage.set('Failed to load trash: ' + err.status + ' ' + err.message);
        },
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
        error: () => this.errorMessage.set('Search failed.'),
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
      error: () => this.errorMessage.set('Failed to load more.'),
    });
  }

  // ── File actions ──────────────────────────────────────────────

  deleteFile(file: FileMetadata): void {
    this.requestDelete({ type: 'file', name: file.originalFileName }, () => {
      this.fileService.deletePermanently(file.id).subscribe({
        next: () => {
          this.files.update((files) => files.filter((f) => f.id !== file.id));
          this.dashboardStore.refresh();
        },
        error: () => this.errorMessage.set('Failed to delete file.'),
      });
    });
  }

  restoreFile(file: FileMetadata): void {
    this.fileService.restore(file.id).subscribe({
      next: () => {
        this.files.update((files) => files.filter((f) => f.id !== file.id));
        this.dashboardStore.refresh();
      },
      error: () => this.errorMessage.set('Failed to restore file.'),
    });
  }

  // ── Folder actions ────────────────────────────────────────────

  restoreFolder(folder: Folder): void {
    this.folderService.restoreFolder(folder.id).subscribe({
      next: () => {
        this.folders.update((folders) => folders.filter((f) => f.id !== folder.id));
        this.dashboardStore.refresh();
      },
      error: () => this.errorMessage.set('Failed to restore folder.'),
    });
  }

  deleteFolderForever(folder: Folder): void {
    this.requestDelete({ type: 'folder', name: folder.name }, () => {
      this.folderService.deleteFolder(folder.id).subscribe({
        next: () => {
          this.folders.update((folders) => folders.filter((f) => f.id !== folder.id));
          this.dashboardStore.refresh();
        },
        error: () => this.errorMessage.set('Failed to delete folder.'),
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
        finalize(() => this.dashboardStore.refresh()),
      )
      .subscribe(() => {
        const fileIds = new Set(selectedFiles.map((f) => f.id));
        const folderIds = new Set(selectedFolders.map((f) => f.id));
        this.files.update((files) => files.filter((f) => !fileIds.has(f.id)));
        this.folders.update((folders) => folders.filter((f) => !folderIds.has(f.id)));
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
          finalize(() => this.dashboardStore.refresh()),
        )
        .subscribe(() => {
          const fileIds = new Set(selectedFiles.map((f) => f.id));
          const folderIds = new Set(selectedFolders.map((f) => f.id));
          this.files.update((files) => files.filter((f) => !fileIds.has(f.id)));
          this.folders.update((folders) => folders.filter((f) => !folderIds.has(f.id)));
        });
    });
  }

  emptyTrash(): void {
    const total = this.totalCount();
    if (total === 0) return;
    this.requestDelete({ type: 'emptyTrash', count: total }, () => {
      const fileDeletes = this.files().map((f) => this.fileService.deletePermanently(f.id));
      const folderDeletes = this.folders().map((f) => this.folderService.deleteFolder(f.id));
      from([...fileDeletes, ...folderDeletes])
        .pipe(
          concatMap((req) => req),
          finalize(() => this.dashboardStore.refresh()),
        )
        .subscribe({
          next: () => {
            this.files.set([]);
            this.folders.set([]);
          },
          error: () => this.errorMessage.set('Failed to empty trash.'),
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
