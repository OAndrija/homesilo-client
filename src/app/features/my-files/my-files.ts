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
import { Files } from '../../core/services/files';
import { FileMetadata } from '../../core/models/file-metadata';
import { catchError, concatMap, finalize, from, of } from 'rxjs';
import { FileTable } from '../../shared/file-table/file-table';
import { Search } from '../../core/services/search';
import { isPreviewable } from '../../core/utils/file-preview.utils';
import { SelectionBar } from '../../shared/selection-bar/selection-bar';
import { DashboardStore } from '../../core/services/dashboard-store';
import { LoadingDelayPipe } from '../../shared/pipes/loading-delay';

@Component({
  selector: 'app-my-files',
  imports: [FileTable, SelectionBar, LoadingDelayPipe],
  templateUrl: './my-files.html',
  styleUrl: './my-files.css',
})
export class MyFiles {
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
  fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  uploading = signal(false);
  uploadTotal = signal(0);
  uploadCompleted = signal(0);
  uploadFailedCount = signal(0);

  dragging = signal(false);
  private dragCounter = 0;

  isSearching = computed(() => this.searchService.query().trim().length > 0);

  constructor() {
    effect(() => {
      const query = this.searchService.query().trim();
      this.currentPage.set(0);
      if (query === '') {
        this.loadFiles();
      } else {
        this.runSearch(query);
      }
    });
  }

  runSearch(query: string): void {
    this.loading.set(true);
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

  loadFiles(): void {
    this.loading.set(true);
    this.fileService
      .listActive()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          this.files.set(response.content);
          this.hasMore.set(!response.last);
        },
        error: () => this.errorMessage.set('Failed to load files.'),
      });
  }

  loadMore(): void {
    const nextPage = this.currentPage() + 1;
    const query = this.searchService.query().trim();
    this.loadingMore.set(true);

    const request$ =
      query === ''
        ? this.fileService.listActive(nextPage)
        : this.fileService.searchActive(query, nextPage);

    request$.pipe(finalize(() => this.loadingMore.set(false))).subscribe({
      next: (response) => {
        this.files.update((files) => [...files, ...response.content]);
        this.currentPage.set(nextPage);
        this.hasMore.set(!response.last);
      },
      error: () => this.errorMessage.set('Failed to load more files.'),
    });
  }

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

    from(filesToUpload)
      .pipe(
        concatMap((file) =>
          this.fileService.upload(file).pipe(
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

  onDownloadAll(): void {
    const selected = this.getSelectedFiles();
    selected.forEach((file) => this.downloadFile(file));
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
        this.fileTable()?.clearSelection();
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
    this.fileTable()?.clearSelection();
  }

  private getSelectedFiles(): FileMetadata[] {
    const ids = this.fileTable()?.selectedIds() ?? new Set();
    return this.files().filter((f) => ids.has(f.id));
  }

  //Drag and Drop functions

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
    if (this.hasFiles(event)) {
      this.dragging.set(true);
    }
  }

  onDragOver(event: DragEvent): void {
    // Must preventDefault here too, or the browser blocks drop entirely
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
