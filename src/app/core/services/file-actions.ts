import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { FileMetadata } from '../models/file-metadata';
import { Folder } from '../models/folder';
import { isPreviewable } from '../utils/file-preview.utils';
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

  /** Opens a preview in a new tab. Returns false if the type can't be previewed. */
  open(file: FileMetadata): boolean {
    if (!isPreviewable(file.contentType)) return false;
    this.document.defaultView?.open(this.files.previewUrl(file.id), '_blank', 'noopener');
    return true;
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
