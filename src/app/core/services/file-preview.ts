import { computed, Injectable, signal } from '@angular/core';
import { FileMetadata } from '../models/file-metadata';

export type PreviewKind = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'none';

/** How the in-app viewer shows a file, from its content type. */
export function previewKind(contentType: string | null | undefined): PreviewKind {
  const type = (contentType ?? '').toLowerCase();
  if (type === 'application/pdf') return 'pdf';
  // SVG can carry script, so the server only ever serves it as plain text.
  if (type === 'image/svg+xml') return 'text';
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  if (type.startsWith('text/') || type === 'application/json' || type === 'application/xml') {
    return 'text';
  }
  return 'none';
}

/**
 * State of the full-screen file viewer. A page opens it with the file that was
 * clicked and the list it came from, so the viewer can step through that list.
 */
@Injectable({ providedIn: 'root' })
export class FilePreviewService {
  private readonly state = signal<{ files: FileMetadata[]; index: number } | null>(null);

  readonly isOpen = computed(() => this.state() !== null);
  readonly current = computed(() => {
    const s = this.state();
    return s ? s.files[s.index] : null;
  });
  readonly index = computed(() => this.state()?.index ?? 0);
  readonly count = computed(() => this.state()?.files.length ?? 0);
  readonly hasPrevious = computed(() => this.index() > 0);
  readonly hasNext = computed(() => this.index() < this.count() - 1);

  show(file: FileMetadata, list: FileMetadata[] = [file]): void {
    const files = list.some((f) => f.id === file.id) ? list : [file];
    this.state.set({ files, index: files.findIndex((f) => f.id === file.id) });
  }

  next(): void {
    if (this.hasNext()) this.state.update((s) => s && { ...s, index: s.index + 1 });
  }

  previous(): void {
    if (this.hasPrevious()) this.state.update((s) => s && { ...s, index: s.index - 1 });
  }

  close(): void {
    this.state.set(null);
  }
}
