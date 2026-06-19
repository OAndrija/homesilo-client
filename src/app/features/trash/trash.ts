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
  errorMessage = signal('');

  ngOnInit() {
    this.loadTrashedFiles();
  }

  loadTrashedFiles(): void {
    this.loading.set(true);
    this.fileService
      .listTrashed()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => this.files.set(response.content),
        error: () => this.errorMessage.set('Failed to load trashed files.'),
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
