import { Component, input, output } from '@angular/core';
import { FileMetadata } from '../../core/models/file-metadata';
import { DatePipe } from '@angular/common';

export type FileAction = 'download' | 'trash' | 'restore' | 'deleteForever' | 'star';

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

  hasAction(action: FileAction): boolean {
    return this.actions().includes(action);
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
