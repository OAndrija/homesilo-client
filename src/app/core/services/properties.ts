import { Injectable, signal } from '@angular/core';
import { FileMetadata } from '../models/file-metadata';
import { Folder } from '../models/folder';

export type PropertiesTarget =
  | { kind: 'file'; item: FileMetadata }
  | { kind: 'folder'; item: Folder };

/** Which file or folder's properties are showing; the dialog lives in the layout. */
@Injectable({ providedIn: 'root' })
export class PropertiesService {
  readonly target = signal<PropertiesTarget | null>(null);

  showFile(file: FileMetadata): void {
    this.target.set({ kind: 'file', item: file });
  }

  showFolder(folder: Folder): void {
    this.target.set({ kind: 'folder', item: folder });
  }

  close(): void {
    this.target.set(null);
  }
}
