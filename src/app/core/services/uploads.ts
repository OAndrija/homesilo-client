import { HttpEventType } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { errorMessage } from '../http/http-error';
import { FileMetadata } from '../models/file-metadata';
import { DashboardStore } from './dashboard-store';
import { Files } from './files';

export type UploadStatus = 'queued' | 'uploading' | 'done' | 'error' | 'cancelled';

export interface UploadItem {
  id: number;
  name: string;
  size: number;
  folderId: string | null;
  status: UploadStatus;
  /** 0–100 while uploading. */
  progress: number;
  error?: string;
}

/**
 * The app-wide upload queue behind the upload panel. Files upload one at a time
 * (gentle on a home server), keep going while the user moves between pages, and
 * report progress per file. Pages listen to `uploaded` to show new files.
 */
@Injectable({ providedIn: 'root' })
export class UploadService {
  private files = inject(Files);
  private store = inject(DashboardStore);

  readonly items = signal<UploadItem[]>([]);
  /** The panel is minimised to its header. Lives here so the layout can make room for it. */
  readonly collapsed = signal(false);
  /** Emits each file as soon as it has been stored. */
  readonly uploaded = new Subject<{ file: FileMetadata; folderId: string | null }>();

  readonly active = computed(() =>
    this.items().some((i) => i.status === 'queued' || i.status === 'uploading'),
  );
  readonly doneCount = computed(() => this.items().filter((i) => i.status === 'done').length);
  readonly failedCount = computed(() => this.items().filter((i) => i.status === 'error').length);
  readonly remainingCount = computed(
    () => this.items().filter((i) => i.status === 'queued' || i.status === 'uploading').length,
  );

  private pending = new Map<number, File>();
  private nextId = 1;
  private current: { id: number; subscription: Subscription } | null = null;

  enqueue(files: File[], folderId: string | null): void {
    const added = files.map((file) => {
      const id = this.nextId++;
      this.pending.set(id, file);
      return {
        id,
        name: file.name,
        size: file.size,
        folderId,
        status: 'queued' as const,
        progress: 0,
      };
    });
    // A new batch replaces finished entries from earlier ones.
    this.items.update((items) => [...items.filter((i) => !isFinished(i)), ...added]);
    this.processNext();
  }

  cancel(id: number): void {
    if (this.current?.id === id) {
      this.current.subscription.unsubscribe();
      this.current = null;
    }
    this.pending.delete(id);
    this.patch(id, { status: 'cancelled' });
    this.processNext();
  }

  retry(id: number): void {
    const item = this.items().find((i) => i.id === id);
    if (!item || item.status !== 'error' || !this.pending.has(id)) return;
    this.patch(id, { status: 'queued', progress: 0, error: undefined });
    this.processNext();
  }

  /** Clears the panel; only once nothing is still uploading. */
  dismiss(): void {
    if (this.active()) return;
    this.items.set([]);
    this.pending.clear();
  }

  private processNext(): void {
    if (this.current) return;
    const next = this.items().find((i) => i.status === 'queued');
    if (!next) {
      this.store.refresh();
      return;
    }
    const file = this.pending.get(next.id);
    if (!file) {
      this.patch(next.id, { status: 'cancelled' });
      this.processNext();
      return;
    }

    this.patch(next.id, { status: 'uploading', progress: 0 });
    const subscription = this.files.uploadWithProgress(file, next.folderId).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          // Hold at 99% until the server has stored the file and answered.
          this.patch(next.id, {
            progress: Math.min(99, Math.round((event.loaded / event.total) * 100)),
          });
        } else if (event.type === HttpEventType.Response && event.body) {
          this.pending.delete(next.id);
          this.patch(next.id, { status: 'done', progress: 100 });
          this.uploaded.next({ file: event.body, folderId: next.folderId });
        }
      },
      error: (err) => {
        this.patch(next.id, {
          status: 'error',
          error: errorMessage(err, 'Upload failed.'),
        });
        this.finishCurrent();
      },
      complete: () => this.finishCurrent(),
    });
    this.current = { id: next.id, subscription };
  }

  private finishCurrent(): void {
    this.current = null;
    // Let the subscribe call that set `current` return before starting the next file.
    queueMicrotask(() => this.processNext());
  }

  private patch(id: number, changes: Partial<UploadItem>): void {
    this.items.update((items) => items.map((i) => (i.id === id ? { ...i, ...changes } : i)));
  }
}

function isFinished(item: UploadItem): boolean {
  return item.status === 'done' || item.status === 'error' || item.status === 'cancelled';
}
