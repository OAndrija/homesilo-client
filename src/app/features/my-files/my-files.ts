import {
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
  HostListener,
  computed,
  effect,
} from '@angular/core';
import { map } from 'rxjs/operators';
import { Files } from '../../core/services/files';
import { Folders } from '../../core/services/folders';
import { FileMetadata } from '../../core/models/file-metadata';
import { catchError, concatMap, finalize, from, of } from 'rxjs';
import { FileTable } from '../../shared/file-table/file-table';
import { Search } from '../../core/services/search';
import { isPreviewable } from '../../core/utils/file-preview.utils';
import { SelectionBar } from '../../shared/selection-bar/selection-bar';
import { DashboardStore } from '../../core/services/dashboard-store';
import { LoadingDelayPipe } from '../../shared/pipes/loading-delay';
import { Folder } from '../../core/models/folder';
import { FolderPickerDialog } from '../../shared/folder-picker-dialog/folder-picker-dialog';

@Component({
  selector: 'app-my-files',
  imports: [FileTable, SelectionBar, LoadingDelayPipe, FolderPickerDialog],
  templateUrl: './my-files.html',
  styleUrl: './my-files.css',
})
export class MyFiles {
  private fileService = inject(Files);
  private folderService = inject(Folders);
  private searchService = inject(Search);
  private dashboardStore = inject(DashboardStore);

  fileTable = viewChild(FileTable);

  // ── Navigation state ─────────────────────────────────────────
  currentFolderId = signal<string | null>(null);
  breadcrumb = signal<Folder[]>([]);

  // ── Content ───────────────────────────────────────────────────
  folders = signal<Folder[]>([]);
  files = signal<FileMetadata[]>([]);

  loading = signal(true);
  loadingMore = signal(false);
  errorMessage = signal('');
  currentPage = signal(0);
  hasMore = signal(false);
  fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  uploading = signal(false);
  uploadTotal = signal(0);
  uploadCompleted = signal(0);
  uploadFailedCount = signal(0);

  dragging = signal(false);
  private dragCounter = 0;

  isSearching = computed(() => this.searchService.query().trim().length > 0);
  isAtRoot = computed(() => this.currentFolderId() === null);

  showMoveDialog = signal(false);

  contentSummary = computed(() => {
    const f = this.folders().length;
    const fi = this.files().length;
    const parts: string[] = [];
    if (f > 0) parts.push(`${f} folder${f !== 1 ? 's' : ''}`);
    if (fi > 0) parts.push(`${fi} file${fi !== 1 ? 's' : ''}`);
    return parts.length > 0 ? parts.join(', ') : 'Empty folder';
  });

  constructor() {
    effect(() => {
      const query = this.searchService.query().trim();
      const folderId = this.currentFolderId(); // reactive dependency — re-runs when folder changes
      this.currentPage.set(0);
      if (query === '') {
        this.loadContents(folderId, 0);
      } else {
        this.runSearch(query);
      }
    });
  }

  // ── Load ─────────────────────────────────────────────────────

  private loadContents(folderId: string | null, page: number): void {
    this.loading.set(true);

    const request$ =
      folderId === null
        ? this.folderService.getRootContents(page)
        : this.folderService.getFolderContents(folderId, page);

    request$.pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (response) => {
        this.folders.set(response.subfolders);
        if (page === 0) {
          this.files.set(response.files.content);
        } else {
          this.files.update((f) => [...f, ...response.files.content]);
        }
        this.breadcrumb.set(response.breadcrumb ?? []);
        this.hasMore.set(!response.files.last);
        this.currentPage.set(page);
      },
      error: () => this.errorMessage.set('Failed to load files.'),
    });
  }

  runSearch(query: string): void {
    this.loading.set(true);
    this.folders.set([]); // global search doesn't show folders
    this.fileService
      .searchActive(query, 0)
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
      error: () => this.errorMessage.set('Failed to load more files.'),
    });
  }

  // ── Folder navigation ─────────────────────────────────────────

  navigateToFolder(folder: Folder): void {
    this.currentFolderId.set(folder.id);
    this.fileTable()?.clearSelection();
  }

  navigateViaBreadcrumb(folder: Folder | null): void {
    this.currentFolderId.set(folder?.id ?? null);
    this.fileTable()?.clearSelection();
  }

  createFolder(): void {
    const name = prompt('Folder name:');
    if (!name?.trim()) return;
    this.folderService.createFolder(name.trim(), this.currentFolderId()).subscribe({
      next: (folder) => this.folders.update((f) => [...f, folder]),
      error: (err) => {
        const msg = err?.error?.message ?? 'Failed to create folder.';
        this.errorMessage.set(msg);
      },
    });
  }

  trashFolder(folder: Folder): void {
    this.folderService.trashFolder(folder.id).subscribe({
      next: () => {
        this.folders.update((f) => f.filter((fo) => fo.id !== folder.id));
        this.dashboardStore.refresh();
      },
      error: () => this.errorMessage.set('Failed to move folder to trash.'),
    });
  }

  // ── File actions ──────────────────────────────────────────────

  triggerFilePicker(): void {
    this.fileInput()?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const fileList = input.files;
    if (!fileList || fileList.length === 0) return;
    this.uploadFiles(Array.from(fileList));
    input.value = '';
  }

  private uploadFiles(filesToUpload: File[]): void {
    this.uploading.set(true);
    this.uploadTotal.set(filesToUpload.length);
    this.uploadCompleted.set(0);
    this.uploadFailedCount.set(0);
    const targetFolderId = this.currentFolderId();

    from(filesToUpload)
      .pipe(
        concatMap((file) =>
          this.fileService.upload(file, targetFolderId).pipe(
            catchError(() => {
              this.uploadFailedCount.update((n) => n + 1);
              return of(null);
            }),
          ),
        ),
        finalize(() => {
          this.uploading.set(false);
          this.dashboardStore.refresh();
          if (this.uploadFailedCount() > 0) {
            const failed = this.uploadFailedCount();
            const total = this.uploadTotal();
            this.errorMessage.set(
              `${failed} of ${total} file${total !== 1 ? 's' : ''} failed to upload.`,
            );
          }
        }),
      )
      .subscribe({
        next: (newFile) => {
          this.uploadCompleted.update((n) => n + 1);
          if (newFile) {
            this.files.update((files) => [newFile, ...files]);
          }
        },
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

  // ── Bulk actions ──────────────────────────────────────────────

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

  onMoveAll(): void {
    if ((this.fileTable()?.selectedIds()?.size ?? 0) === 0) return;
    this.showMoveDialog.set(true);
  }

  private getSelectedFiles(): FileMetadata[] {
    const ids = this.fileTable()?.selectedIds() ?? new Set();
    return this.files().filter((f) => ids.has(f.id));
  }

  onMoveConfirm(targetFolderId: string | null): void {
    this.showMoveDialog.set(false);
    const selected = this.getSelectedFiles();
    if (selected.length === 0) return;

    from(selected)
      .pipe(
        concatMap((file) => this.fileService.moveFile(file.id, targetFolderId)),
        finalize(() => this.loadContents(this.currentFolderId(), 0)),
      )
      .subscribe();
  }

  // ── Drag and drop ─────────────────────────────────────────────

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
    const droppedFiles = event.dataTransfer?.files;
    if (!droppedFiles || droppedFiles.length === 0) return;
    this.uploadFiles(Array.from(droppedFiles));
  }

  private hasFiles(event: DragEvent): boolean {
    return Array.from(event.dataTransfer?.types ?? []).includes('Files');
  }
}
