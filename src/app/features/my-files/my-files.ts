import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { Files } from '../../core/services/files';
import { FileMetadata } from '../../core/models/file-metadata';
import { finalize } from 'rxjs';
import { FileTable } from '../../shared/file-table/file-table';

@Component({
  selector: 'app-my-files',
  imports: [FileTable],
  templateUrl: './my-files.html',
  styleUrl: './my-files.css',
})
export class MyFiles {
  private fileService = inject(Files);

  files = signal<FileMetadata[]>([]);
  loading = signal(true);
  loadingMore = signal(false);
  uploading = signal(false);
  errorMessage = signal('');
  currentPage = signal(0);
  hasMore = signal(false);
  fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  ngOnInit() {
    this.loadFiles();
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
        error: () => this.errorMessage.set('Failed to laod files.'),
      });
  }

  loadMore(): void {
    const nextPage = this.currentPage() + 1;
    this.loadingMore.set(true);
    this.fileService
      .listActive(nextPage)
      .pipe(finalize(() => this.loadingMore.set(false)))
      .subscribe({
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
    const file = input.files?.[0];

    if (!file) return;

    this.uploadFile(file);
    input.value = '';
  }

  private uploadFile(file: File): void {
    this.uploading.set(true);

    this.fileService
      .upload(file)
      .pipe(
        finalize(() => {
          this.uploading.set(false);
        }),
      )
      .subscribe({
        next: (newFile) => this.files.update((files) => [newFile, ...files]),
        error: () => this.errorMessage.set('Failed to upload file'),
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
    });
  }
}
