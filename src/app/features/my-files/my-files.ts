import {
  Component,
  computed,
  effect,
  ElementRef,
  HostListener,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, concatMap, finalize, forkJoin, from, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { errorMessage } from '../../core/http/http-error';
import { FileMetadata } from '../../core/models/file-metadata';
import { Folder } from '../../core/models/folder';
import { DashboardStore } from '../../core/services/dashboard-store';
import { FileActions } from '../../core/services/file-actions';
import { Files } from '../../core/services/files';
import { Folders } from '../../core/services/folders';
import { Search } from '../../core/services/search';
import { FileTable, MovePayload } from '../../shared/file-table/file-table';
import { FolderNameDialog } from '../../shared/folder-name-dialog/folder-name-dialog';
import { FolderPickerDialog } from '../../shared/folder-picker-dialog/folder-picker-dialog';
import { LoadingDelayPipe } from '../../shared/pipes/loading-delay';
import { SelectionBar } from '../../shared/selection-bar/selection-bar';

type RenameTarget = { kind: 'file'; item: FileMetadata } | { kind: 'folder'; item: Folder };

@Component({
  selector: 'app-my-files',
  imports: [FileTable, SelectionBar, LoadingDelayPipe, FolderPickerDialog, FolderNameDialog],
  templateUrl: './my-files.html',
  styleUrl: './my-files.css',
})
export class MyFiles {
  private fileService = inject(Files);
  private folderService = inject(Folders);
  private fileActions = inject(FileActions);
  private searchService = inject(Search);
  private dashboardStore = inject(DashboardStore);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  fileTable = viewChild(FileTable);
  fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  // ── Navigation ───────────────────────────────────────────────
  currentFolderId = toSignal(this.route.queryParamMap.pipe(map((p) => p.get('folderId'))), {
    initialValue: null,
  });
  breadcrumb = signal<Folder[]>([]);

  // ── Content ──────────────────────────────────────────────────
  folders = signal<Folder[]>([]);
  files = signal<FileMetadata[]>([]);
  loading = signal(true);
  loadingMore = signal(false);
  errorMessage = signal('');
  currentPage = signal(0);
  hasMore = signal(false);

  // ── Upload ───────────────────────────────────────────────────
  uploading = signal(false);
  uploadTotal = signal(0);
  uploadCompleted = signal(0);
  dragging = signal(false);
  private dragCounter = 0;

  // ── Dialogs ──────────────────────────────────────────────────
  showMoveDialog = signal(false);
  showNewFolderDialog = signal(false);
  renameTarget = signal<RenameTarget | null>(null);

  isSearching = computed(() => this.searchService.query().trim().length > 0);
  isAtRoot = computed(() => this.currentFolderId() === null);
  selectedCount = computed(
    () =>
      (this.fileTable()?.selectedIds().size ?? 0) +
      (this.fileTable()?.selectedFolderIds().size ?? 0),
  );

  contentSummary = computed(() => {
    const folderCount = this.folders().length;
    const fileCount = this.files().length;
    const parts: string[] = [];
    if (folderCount > 0) parts.push(`${folderCount} folder${folderCount !== 1 ? 's' : ''}`);
    if (fileCount > 0) parts.push(`${fileCount} file${fileCount !== 1 ? 's' : ''}`);
    if (parts.length > 0) return parts.join(', ');
    return this.isSearching() ? 'No matches' : 'Empty folder';
  });

  constructor() {
    effect(() => {
      const query = this.searchService.query().trim();
      const folderId = this.currentFolderId(); // re-run on navigation
      this.currentPage.set(0);
      if (query === '') {
        this.loadContents(folderId, 0);
      } else {
        this.runSearch(query);
      }
    });
  }

  // ── Loading ──────────────────────────────────────────────────

  private loadContents(folderId: string | null, page: number): void {
    this.loading.set(true);
    const request$ =
      folderId === null
        ? this.folderService.getRootContents(page)
        : this.folderService.getFolderContents(folderId, page);

    request$.pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (response) => {
        this.folders.set(response.subfolders);
        this.files.update((current) =>
          page === 0 ? response.files.content : [...current, ...response.files.content],
        );
        this.breadcrumb.set(response.breadcrumb ?? []);
        this.hasMore.set(!response.files.last);
        this.currentPage.set(page);
      },
      error: (err) => {
        if (folderId !== null && err?.status === 404) {
          // Stale link to a folder that was deleted or moved to trash.
          this.navigateViaBreadcrumb(null);
          return;
        }
        this.errorMessage.set(errorMessage(err, 'Failed to load files.'));
      },
    });
  }

  /** Searches all files and folders, not just the current folder. */
  private runSearch(query: string): void {
    this.loading.set(true);
    forkJoin({
      files: this.fileService.searchActive(query, 0),
      folders: this.folderService.search(query).pipe(catchError(() => of([] as Folder[]))),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ files, folders }) => {
          this.files.set(files.content);
          this.folders.set(folders);
          this.hasMore.set(!files.last);
        },
        error: (err) => this.errorMessage.set(errorMessage(err, 'Search failed.')),
      });
  }

  loadMore(): void {
    const nextPage = this.currentPage() + 1;
    const query = this.searchService.query().trim();
    const folderId = this.currentFolderId();
    this.loadingMore.set(true);

    const request$ =
      query !== ''
        ? this.fileService.searchActive(query, nextPage)
        : folderId === null
          ? this.folderService.getRootContents(nextPage).pipe(map((r) => r.files))
          : this.folderService.getFolderContents(folderId, nextPage).pipe(map((r) => r.files));

    request$.pipe(finalize(() => this.loadingMore.set(false))).subscribe({
      next: (response) => {
        this.files.update((f) => [...f, ...response.content]);
        this.currentPage.set(nextPage);
        this.hasMore.set(!response.last);
      },
      error: (err) => this.errorMessage.set(errorMessage(err, 'Failed to load more files.')),
    });
  }

  private reload(): void {
    this.loadContents(this.currentFolderId(), 0);
  }

  // ── Navigation ───────────────────────────────────────────────

  navigateToFolder(folder: Folder): void {
    this.searchService.clear();
    this.router.navigate([], { queryParams: { folderId: folder.id } });
    this.fileTable()?.clearSelection();
  }

  navigateViaBreadcrumb(folder: Folder | null): void {
    this.router.navigate([], { queryParams: { folderId: folder?.id ?? null } });
    this.fileTable()?.clearSelection();
  }

  // ── Folders ──────────────────────────────────────────────────

  onNewFolderConfirm(name: string): void {
    this.showNewFolderDialog.set(false);
    this.folderService.createFolder(name, this.currentFolderId()).subscribe({
      next: (folder) =>
        this.folders.update((f) => [...f, folder].sort((a, b) => a.name.localeCompare(b.name))),
      error: (err) => this.errorMessage.set(errorMessage(err, 'Failed to create folder.')),
    });
  }

  trashFolder(folder: Folder): void {
    this.folderService.trashFolder(folder.id).subscribe({
      next: () => {
        this.folders.update((f) => f.filter((fo) => fo.id !== folder.id));
        this.dashboardStore.refresh();
      },
      error: (err) => this.errorMessage.set(errorMessage(err, 'Failed to move folder to trash.')),
    });
  }

  downloadFolder(folder: Folder): void {
    this.fileActions.downloadSelection([], [folder]);
  }

  // ── Rename ───────────────────────────────────────────────────

  renameFile(file: FileMetadata): void {
    this.renameTarget.set({ kind: 'file', item: file });
  }

  renameFolder(folder: Folder): void {
    this.renameTarget.set({ kind: 'folder', item: folder });
  }

  renameInitialName(target: RenameTarget): string {
    return target.kind === 'file' ? target.item.originalFileName : target.item.name;
  }

  onRenameConfirm(name: string): void {
    const target = this.renameTarget();
    this.renameTarget.set(null);
    if (!target) return;

    if (target.kind === 'file') {
      this.fileService.rename(target.item.id, name).subscribe({
        next: (updated) =>
          this.files.update((f) => f.map((x) => (x.id === updated.id ? updated : x))),
        error: (err) => this.errorMessage.set(errorMessage(err, 'Failed to rename file.')),
      });
    } else {
      this.folderService.renameFolder(target.item.id, name).subscribe({
        next: (updated) =>
          this.folders.update((f) => f.map((x) => (x.id === updated.id ? updated : x))),
        error: (err) => this.errorMessage.set(errorMessage(err, 'Failed to rename folder.')),
      });
    }
  }

  // ── Files ────────────────────────────────────────────────────

  triggerFilePicker(): void {
    this.fileInput()?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.uploadFiles(Array.from(input.files));
    }
    input.value = '';
  }

  private uploadFiles(filesToUpload: File[]): void {
    const targetFolderId = this.currentFolderId();
    const failures: string[] = [];
    this.uploading.set(true);
    this.uploadTotal.set(filesToUpload.length);
    this.uploadCompleted.set(0);

    from(filesToUpload)
      .pipe(
        concatMap((file) =>
          this.fileService.upload(file, targetFolderId).pipe(
            catchError((err) => {
              failures.push(errorMessage(err, `"${file.name}" failed to upload.`));
              return of(null);
            }),
          ),
        ),
        finalize(() => {
          this.uploading.set(false);
          this.dashboardStore.refresh();
          if (failures.length === 1) {
            this.errorMessage.set(failures[0]);
          } else if (failures.length > 1) {
            this.errorMessage.set(
              `${failures.length} of ${filesToUpload.length} files failed to upload. ${failures[0]}`,
            );
          }
        }),
      )
      .subscribe((uploaded) => {
        this.uploadCompleted.update((n) => n + 1);
        // The upload is idempotent, so a re-upload may return an entry we already show.
        if (uploaded && !this.isSearching() && this.currentFolderId() === targetFolderId) {
          this.files.update((files) => [uploaded, ...files.filter((f) => f.id !== uploaded.id)]);
        }
      });
  }

  downloadFile(file: FileMetadata): void {
    this.fileActions.download(file);
  }

  openFile(file: FileMetadata): void {
    if (!this.fileActions.open(file)) {
      this.errorMessage.set(
        `Preview isn't available for "${file.originalFileName}". Download it instead.`,
      );
      this.fileTable()?.flashRowError(file.id);
    }
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

  toggleStar(file: FileMetadata): void {
    this.fileService.toggleStar(file.id).subscribe({
      next: (updated) => {
        this.files.update((files) => files.map((f) => (f.id === updated.id ? updated : f)));
        this.dashboardStore.silentRefresh();
      },
      error: (err) => this.errorMessage.set(errorMessage(err, 'Failed to update star.')),
    });
  }

  // ── Bulk actions ─────────────────────────────────────────────

  onDownloadAll(): void {
    this.fileActions.downloadSelection(this.getSelectedFiles(), this.getSelectedFolders());
  }

  onTrashAll(): void {
    const files = this.getSelectedFiles();
    const folders = this.getSelectedFolders();
    this.runSequentially(
      [
        ...files.map((f) => this.fileService.trash(f.id)),
        ...folders.map((f) => this.folderService.trashFolder(f.id)),
      ],
      'Some items could not be moved to trash.',
      () => {
        const fileIds = new Set(files.map((f) => f.id));
        const folderIds = new Set(folders.map((f) => f.id));
        this.files.update((list) => list.filter((f) => !fileIds.has(f.id)));
        this.folders.update((list) => list.filter((f) => !folderIds.has(f.id)));
        this.dashboardStore.refresh();
      },
    );
  }

  onStarAll(): void {
    const files = this.getSelectedFiles();
    from(files)
      .pipe(
        concatMap((file) => this.fileService.toggleStar(file.id)),
        finalize(() => this.dashboardStore.silentRefresh()),
      )
      .subscribe({
        next: (updated) =>
          this.files.update((list) => list.map((f) => (f.id === updated.id ? updated : f))),
        error: (err) => this.errorMessage.set(errorMessage(err, 'Failed to update stars.')),
      });
  }

  onMoveAll(): void {
    if (this.selectedCount() > 0) this.showMoveDialog.set(true);
  }

  onMoveConfirm(targetFolderId: string | null): void {
    this.showMoveDialog.set(false);
    this.moveItems(
      this.getSelectedFiles().map((f) => f.id),
      this.getSelectedFolders().map((f) => f.id),
      targetFolderId,
    );
  }

  onItemsMoved(payload: MovePayload): void {
    this.moveItems(payload.fileIds, payload.folderIds, payload.targetFolderId);
  }

  getSelectedFolderIds(): string[] {
    return [...(this.fileTable()?.selectedFolderIds() ?? new Set<string>())];
  }

  private moveItems(fileIds: string[], folderIds: string[], targetFolderId: string | null): void {
    this.runSequentially(
      [
        ...fileIds.map((id) => this.fileService.moveFile(id, targetFolderId)),
        ...folderIds.map((id) => this.folderService.moveFolder(id, targetFolderId)),
      ],
      'Some items could not be moved.',
      () => this.reload(),
    );
  }

  /** Runs requests one at a time, keeps going past failures, then calls `done` once. */
  private runSequentially(
    requests: Observable<unknown>[],
    failureMessage: string,
    done: () => void,
  ) {
    if (requests.length === 0) return;
    let firstError: unknown = null;
    from(requests)
      .pipe(
        concatMap((request) =>
          request.pipe(
            catchError((err) => {
              firstError ??= err;
              return of(null);
            }),
          ),
        ),
        finalize(() => {
          if (firstError) {
            this.errorMessage.set(errorMessage(firstError, failureMessage));
            this.reload();
          } else {
            done();
          }
        }),
      )
      .subscribe();
  }

  private getSelectedFiles(): FileMetadata[] {
    const ids = this.fileTable()?.selectedIds() ?? new Set<string>();
    return this.files().filter((f) => ids.has(f.id));
  }

  private getSelectedFolders(): Folder[] {
    const ids = this.fileTable()?.selectedFolderIds() ?? new Set<string>();
    return this.folders().filter((f) => ids.has(f.id));
  }

  // ── Drag and drop upload ─────────────────────────────────────

  @HostListener('document:dragover', ['$event'])
  onDocumentDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  @HostListener('document:drop', ['$event'])
  onDocumentDrop(event: DragEvent): void {
    event.preventDefault();
  }

  onDragEnter(event: DragEvent): void {
    event.preventDefault();
    this.dragCounter++;
    if (this.hasFiles(event)) this.dragging.set(true);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragCounter--;
    if (this.dragCounter <= 0) {
      this.dragCounter = 0;
      this.dragging.set(false);
    }
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragCounter = 0;
    this.dragging.set(false);
    const dropped = event.dataTransfer?.files;
    if (dropped && dropped.length > 0) this.uploadFiles(Array.from(dropped));
  }

  private hasFiles(event: DragEvent): boolean {
    return Array.from(event.dataTransfer?.types ?? []).includes('Files');
  }
}
