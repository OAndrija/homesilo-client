import { Component, inject, signal } from '@angular/core';
import { Files } from '../../core/services/files';
import { FileMetadata } from '../../core/models/file-metadata';
import { finalize } from 'rxjs';
import { FileTable } from '../../shared/file-table/file-table';

@Component({
  selector: 'app-trash',
  imports: [FileTable],
  templateUrl: './trash.html',
  styleUrl: './trash.css',
})
export class Trash {
  private fileService = inject(Files);

  files = signal<FileMetadata[]>([]);
  loading = signal(true);
  loadingMore = signal(false);
  errorMessage = signal('');
  currentPage = signal(0);
  hasMore = signal(false);

  ngOnInit() {
    this.loadTrashedFiles();
  }

  loadTrashedFiles(): void {
    this.loading.set(true);
    this.currentPage.set(0);
    this.fileService
      .listTrashed(0)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          this.files.set(response.content);
          this.hasMore.set(!response.last);
        },
        error: () => this.errorMessage.set('Failed to load trashed files.'),
      });
  }

  loadMore(): void {
    const nextPage = this.currentPage() + 1;
    this.loadingMore.set(true);
    this.fileService
      .listTrashed(nextPage)
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

  deleteFile(file: FileMetadata): void {
    if (!confirm(`Permanently delete "${file.originalFileName}"?`)) {
      return;
    }

    this.fileService.deletePermanently(file.id).subscribe({
      next: () => {
        this.files.update((files) => files.filter((f) => f.id !== file.id));
      },
      error: () => {
        this.errorMessage.set('Failed to delete file.');
      },
    });
  }

  restoreFile(file: FileMetadata): void {
    this.fileService.restore(file.id).subscribe(() => {
      this.files.update((files) => files.filter((f) => f.id !== file.id));
    });
  }
}
