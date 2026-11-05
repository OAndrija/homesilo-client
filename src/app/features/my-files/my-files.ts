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
import { ToastService } from '../../core/services/toast';
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
  private toast = inject(ToastService);
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
  loadFailed = signal(false);
  currentPage = signal(0);
  hasMore = signal(false);

  uploading = signal(false);
  dragging = signal(false);
  private dragCounter = 0;

  // ── Dialogs ──────────────────────────────────────────────────
  showMoveDialog = signal(false);
  showNewFolderDialog = signal(false);
  renameTarget = signal<RenameTarget | null>(null);

  query = computed(() => this.searchService.query().trim());
  isSearching = computed(() => this.query().length > 0);
  isAtRoot = computed(() => this.currentFolderId() === null);
  currentFolder = computed(() => this.breadcrumb().at(-1) ?? null);
  /** Ancestors shown above the title (the title itself is the current folder). */
  ancestors = computed(() => this.breadcrumb().slice(0, -1));
  title = computed(() => {
    if (this.isSearching()) return 'Search results';
    return this.isAtRoot() ? 'My Files' : (this.currentFolder()?.name ?? 'My Files');
  });
  selectedCount = computed(
    () =>
      (this.fileTable()?.selectedIds().size ?? 0) +
      (this.fileTable()?.selectedFolderIds().size ?? 0),
  );

  contentSummary = computed(() => {
    if (this.isSearching()) return `Matches for “${this.query()}” across all your files`;
    const folderCount = this.folders().length;
    const fileCount = this.files().length;
    const parts: string[] = [];
    if (folderCount > 0) parts.push(`${folderCount} folder${folderCount !== 1 ? 's' : ''}`);
    if (fileCount > 0)
      parts.push(`${fileCount}${this.hasMore() ? '+' : ''} file${fileCount !== 1 ? 's' : ''}`);
    return parts.length > 0 ? parts.join(', ') : 'Empty';
  });

  constructor() {
    effect(() => {
      const query = this.query();
      const folderId = this.currentFolderId(); // re-run on navigation
      this.currentPage.set(0);
      if (query === '') this.loadContents(folderId, 0);
      else this.runSearch(query);
    });
  }

  // ── Loading ──────────────────────────────────────────────────

  private loadContents(folderId: string | null, page: number): void {
    this.loading.set(true);
    this.loadFailed.set(false);
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
          this.toast.info('That folder no longer exists.');
          this.navigateViaBreadcrumb(null);
          return;
        }
        this.loadFailed.set(true);
        this.toast.error(errorMessage(err, 'Couldn’t load your files.'));
      },
    });
  }

  /** Searches all files and folders, not just the current folder. */
  private runSearch(query: string): void {
    this.loading.set(true);
    this.loadFailed.set(false);
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
        error: (err) => {
          this.loadFailed.set(true);
          this.toast.error(errorMessage(err, 'Search failed.'));
        },
      });
  }

  retry(): void {
    if (this.isSearching()) this.runSearch(this.query());
    else this.reload();
  }

  loadMore(): void {
    const nextPage = this.currentPage() + 1;
    const folderId = this.currentFolderId();
    this.loadingMore.set(true);

    const request$ = this.isSearching()
      ? this.fileService.searchActive(this.query(), nextPage)
      : folderId === null
        ? this.folderService.getRootContents(nextPage).pipe(map((r) => r.files))
        : this.folderService.getFolderContents(folderId, nextPage).pipe(map((r) => r.files));

    request$.pipe(finalize(() => this.loadingMore.set(false))).subscribe({
      next: (response) => {
        this.files.update((f) => [...f, ...response.content]);
        this.currentPage.set(nextPage);
        this.hasMore.set(!response.last);
      },
      error: (err) => this.toast.error(errorMessage(err, 'Couldn’t load more files.')),
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
      next: (folder) => {
        this.folders.update((f) => [...f, folder].sort((a, b) => a.name.localeCompare(b.name)));
        this.toast.success(`Created folder “${folder.name}”`);
      },
      error: (err) => this.toast.error(errorMessage(err, 'Couldn’t create the folder.')),
    });
  }

  trashFolder(folder: Folder): void {
    this.folderService.trashFolder(folder.id).subscribe({
      next: () => {
        this.folders.update((f) => f.filter((fo) => fo.id !== folder.id));
        this.dashboardStore.refresh();
        this.toast.success(`Moved “${folder.name}” to trash`, {
          label: 'Undo',
          run: () => this.undo([this.folderService.restoreFolder(folder.id)]),
        });
      },
      error: (err) => this.toast.error(errorMessage(err, 'Couldn’t move the folder to trash.')),
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
        error: (err) => this.toast.error(errorMessage(err, 'Couldn’t rename the file.')),
      });
    } else {
      this.folderService.renameFolder(target.item.id, name).subscribe({
        next: (updated) =>
          this.folders.update((f) => f.map((x) => (x.id === updated.id ? updated : x))),
        error: (err) => this.toast.error(errorMessage(err, 'Couldn’t rename the folder.')),
      });
    }
  }

  // ── Files ────────────────────────────────────────────────────

  triggerFilePicker(): void {
    this.fileInput()?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) this.uploadFiles(Array.from(input.files));
    input.value = '';
  }

  private uploadFiles(filesToUpload: File[]): void {
    const targetFolderId = this.currentFolderId();
    const total = filesToUpload.length;
    const failures: string[] = [];
    let done = 0;
    const progressLabel = () =>
      total === 1 ? `Uploading “${filesToUpload[0].name}”…` : `Uploading ${done + 1} of ${total}…`;
    const toastId = this.toast.progress(progressLabel());
    this.uploading.set(true);

    from(filesToUpload)
      .pipe(
        concatMap((file) =>
          this.fileService.upload(file, targetFolderId).pipe(
            catchError((err) => {
              failures.push(errorMessage(err, `“${file.name}” failed to upload.`));
              return of(null);
            }),
          ),
        ),
        finalize(() => {
          this.uploading.set(false);
          this.dashboardStore.refresh();
          const succeeded = total - failures.length;
          if (failures.length === 0) {
            this.toast.update(
              toastId,
              'success',
              total === 1 ? 'Upload complete' : `Uploaded ${total} files`,
            );
          } else if (succeeded === 0) {
            this.toast.update(
              toastId,
              'error',
              failures.length === 1
                ? failures[0]
                : `None of the ${total} files uploaded. ${failures[0]}`,
            );
          } else {
            this.toast.update(
              toastId,
              'error',
              `Uploaded ${succeeded} of ${total} files. ${failures[0]}`,
            );
          }
        }),
      )
      .subscribe((uploaded) => {
        done++;
        if (done < total) this.toast.update(toastId, 'progress', progressLabel());
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
      this.toast.info(`“${file.originalFileName}” can’t be previewed. Download it instead.`, {
        label: 'Download',
        run: () => this.fileActions.download(file),
      });
      this.fileTable()?.flashRowError(file.id);
    }
  }

  trashFile(file: FileMetadata): void {
    this.fileService.trash(file.id).subscribe({
      next: () => {
        this.files.update((files) => files.filter((f) => f.id !== file.id));
        this.dashboardStore.refresh();
        this.toast.success(`Moved “${file.originalFileName}” to trash`, {
          label: 'Undo',
          run: () => this.undo([this.fileService.restore(file.id)]),
        });
      },
      error: (err) => this.toast.error(errorMessage(err, 'Couldn’t move the file to trash.')),
    });
  }

  toggleStar(file: FileMetadata): void {
    this.fileService.toggleStar(file.id).subscribe({
      next: (updated) => {
        this.files.update((files) => files.map((f) => (f.id === updated.id ? updated : f)));
        this.dashboardStore.silentRefresh();
      },
      error: (err) => this.toast.error(errorMessage(err, 'Couldn’t update the star.')),
    });
  }

  // ── Bulk actions ─────────────────────────────────────────────

  onDownloadAll(): void {
    this.fileActions.downloadSelection(this.getSelectedFiles(), this.getSelectedFolders());
  }

  onTrashAll(): void {
    const files = this.getSelectedFiles();
    const folders = this.getSelectedFolders();
    const count = files.length + folders.length;
    this.runSequentially(
      [
        ...files.map((f) => this.fileService.trash(f.id)),
        ...folders.map((f) => this.folderService.trashFolder(f.id)),
      ],
      'Some items couldn’t be moved to trash.',
      () => {
        const fileIds = new Set(files.map((f) => f.id));
        const folderIds = new Set(folders.map((f) => f.id));
        this.files.update((list) => list.filter((f) => !fileIds.has(f.id)));
        this.folders.update((list) => list.filter((f) => !folderIds.has(f.id)));
        this.dashboardStore.refresh();
        this.toast.success(`Moved ${count} item${count !== 1 ? 's' : ''} to trash`, {
          label: 'Undo',
          run: () =>
            this.undo([
              ...files.map((f) => this.fileService.restore(f.id)),
              ...folders.map((f) => this.folderService.restoreFolder(f.id)),
            ]),
        });
      },
    );
  }

  onStarAll(): void {
    const files = this.getSelectedFiles();
    // Star everything unless everything is already starred, then unstar.
    const target = !files.every((f) => f.starred);
    from(files.filter((f) => f.starred !== target))
      .pipe(
        concatMap((file) => this.fileService.toggleStar(file.id)),
        finalize(() => this.dashboardStore.silentRefresh()),
      )
      .subscribe({
        next: (updated) =>
          this.files.update((list) => list.map((f) => (f.id === updated.id ? updated : f))),
        error: (err) => this.toast.error(errorMessage(err, 'Couldn’t update stars.')),
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
    const count = fileIds.length + folderIds.length;
    this.runSequentially(
      [
        ...fileIds.map((id) => this.fileService.moveFile(id, targetFolderId)),
        ...folderIds.map((id) => this.folderService.moveFolder(id, targetFolderId)),
      ],
      'Some items couldn’t be moved.',
      () => {
        this.reload();
        this.toast.success(`Moved ${count} item${count !== 1 ? 's' : ''}`);
      },
    );
  }

  private undo(requests: Observable<unknown>[]): void {
    this.runSequentially(requests, 'Couldn’t undo.', () => {
      this.reload();
      this.dashboardStore.refresh();
      this.toast.info('Restored');
    });
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
            this.toast.error(errorMessage(firstError, failureMessage));
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
    if (!this.hasFiles(event)) return;
    event.preventDefault();
    this.dragCounter++;
    this.dragging.set(true);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDragLeave(event: DragEvent): void {
    if (!this.hasFiles(event)) return;
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
