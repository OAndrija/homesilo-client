import { Component, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FileMetadata } from '../../core/models/file-metadata';
import { getFileIcon } from '../../core/utils/file-icon.util';

export type FileAction = 'download' | 'trash' | 'restore' | 'deleteForever';

@Component({
  selector: 'app-file-table',
  imports: [DatePipe],
  templateUrl: './file-table.html',
  styleUrl: './file-table.css',
})
export class FileTable {
  files = input.required<FileMetadata[]>();
  actions = input<FileAction[]>(['download', 'trash']);
  dateColumnLabel = input('Uploaded');

  download = output<FileMetadata>();
  trash = output<FileMetadata>();
  restore = output<FileMetadata>();
  deleteForever = output<FileMetadata>();
  openFile = output<FileMetadata>();

  errorRowId = signal<string | null>(null);
  private errorTimeout?: ReturnType<typeof setTimeout>;

  hasAction(action: FileAction): boolean {
    return this.actions().includes(action);
  }

  getFileIcon = getFileIcon;

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  flashRowError(fileId: string): void {
    clearTimeout(this.errorTimeout);
    this.errorRowId.set(fileId);
    this.errorTimeout = setTimeout(() => this.errorRowId.set(null), 1200);
  }
}
