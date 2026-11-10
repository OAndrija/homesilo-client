import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { FileMetadata } from '../models/file-metadata';
import { Folder } from '../models/folder';
import { FilePreviewService } from './file-preview';
import { Files } from './files';

/**
 * Download and preview actions shared by every file list. The browser fetches
 * the URLs itself (the session cookie rides along), so downloads stream straight
 * to disk with native progress instead of being buffered in a Blob.
 */
@Injectable({ providedIn: 'root' })
export class FileActions {
  private files = inject(Files);
  private document = inject(DOCUMENT);
  private preview = inject(FilePreviewService);

  download(file: FileMetadata): void {
    this.navigate(this.files.downloadUrl(file.id));
  }

  /** One file downloads as-is; anything else (or any folder) becomes a zip. */
  downloadSelection(files: FileMetadata[], folders: Folder[] = []): void {
    if (files.length === 0 && folders.length === 0) return;
    if (files.length === 1 && folders.length === 0) {
      this.download(files[0]);
      return;
    }
    this.navigate(
      this.files.zipUrl(
        files.map((f) => f.id),
        folders.map((f) => f.id),
      ),
    );
  }

  /**
   * Opens the in-app viewer on this file. `list` is the list it was opened from,
   * so the viewer's previous/next arrows step through it.
   */
  open(file: FileMetadata, list?: FileMetadata[]): void {
    this.preview.show(file, list);
  }

  private navigate(url: string): void {
    const link = this.document.createElement('a');
    link.href = url;
    link.rel = 'noopener';
    // `download` without a value keeps the server's Content-Disposition filename.
    link.setAttribute('download', '');
    this.document.body.appendChild(link);
    link.click();
    link.remove();
  }
}
