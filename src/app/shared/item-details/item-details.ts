import { DecimalPipe } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { forkJoin, map, Observable, of } from 'rxjs';
import { errorMessage } from '../../core/http/http-error';
import { FileMetadata } from '../../core/models/file-metadata';
import { Folder, FolderSummary } from '../../core/models/folder';
import { Files } from '../../core/services/files';
import { Folders } from '../../core/services/folders';
import { PropertiesTarget } from '../../core/services/properties';
import { describeKind } from '../../core/utils/file-kind';
import { formatBytes } from '../../core/utils/format';
import { ExactDatePipe } from '../pipes/friendly-date';

export interface FileDetails {
  kind: 'file';
  file: FileMetadata;
  /** Folders from the top of My Files down to the one holding the file. */
  path: Folder[];
}

export interface FolderDetails {
  kind: 'folder';
  folder: Folder;
  /** Folders above this one, from the top. */
  path: Folder[];
  summary: FolderSummary;
}

/**
 * The facts about a file or folder (type, size, location, dates, star), loaded
 * fresh from the server. Shown in the Properties dialog and the viewer's
 * details panel; each decides what to do around it.
 */
@Component({
  selector: 'app-item-details',
  imports: [ExactDatePipe, DecimalPipe],
  templateUrl: './item-details.html',
  styleUrl: './item-details.css',
})
export class ItemDetails {
  private files = inject(Files);
  private folders = inject(Folders);

  target = input.required<PropertiesTarget>();
  /** In the viewer, the file is already on screen, so whether it has a preview isn't news. */
  inViewer = input(false);
  /** A folder of the location was clicked (null for the top of My Files). */
  goTo = output<string | null>();
  /** The fresh copy, once loaded. */
  loaded = output<FileDetails | FolderDetails>();

  details = signal<FileDetails | FolderDetails | null>(null);
  loading = signal(false);
  error = signal('');

  /** The fresh copy once loaded, the given one until then. */
  file = computed(() => {
    const d = this.details();
    if (d?.kind === 'file') return d.file;
    const t = this.target();
    return t.kind === 'file' ? t.item : null;
  });
  folder = computed(() => {
    const d = this.details();
    if (d?.kind === 'folder') return d.folder;
    const t = this.target();
    return t.kind === 'folder' ? t.item : null;
  });
  kind = computed(() => {
    const file = this.file();
    return file ? describeKind(file.originalFileName, file.contentType) : 'Folder';
  });
  trashed = computed(() => this.file()?.trashed ?? this.folder()?.trashed ?? false);
  path = computed(() => this.details()?.path ?? []);
  summary = computed(() => {
    const d = this.details();
    return d?.kind === 'folder' ? d.summary : null;
  });
  readonly formatBytes = formatBytes;

  constructor() {
    effect(() => {
      const target = this.target();
      untracked(() => {
        this.details.set(null);
        this.error.set('');
        this.load(target);
      });
    });
  }

  private load(target: PropertiesTarget): void {
    this.loading.set(true);
    const request: Observable<FileDetails | FolderDetails> =
      target.kind === 'file'
        ? this.files
            .getMetadata(target.item.id)
            .pipe(map((file) => ({ kind: 'file' as const, file, path: [] as Folder[] })))
        : forkJoin({
            summary: this.folders.summary(target.item.id),
            contents: this.folders.getFolderContents(target.item.id, 0, 1),
          }).pipe(
            map(({ summary, contents }) => ({
              kind: 'folder' as const,
              folder: contents.folder ?? target.item,
              // The breadcrumb ends with the folder itself.
              path: contents.breadcrumb.slice(0, -1),
              summary,
            })),
          );

    request.subscribe({
      next: (details) => {
        // Another item may have been picked while this one loaded.
        if (this.target() !== target) return;
        if (details.kind === 'file' && details.file.folderId) {
          this.pathOf(details.file.folderId).subscribe((path) => {
            if (this.target() === target) this.details.set({ ...details, path });
          });
        }
        this.details.set(details);
        this.loaded.emit(details);
        this.loading.set(false);
      },
      error: (err) => {
        if (this.target() !== target) return;
        this.error.set(errorMessage(err, 'Couldn’t load the details.'));
        this.loading.set(false);
      },
    });
  }

  private pathOf(folderId: string): Observable<Folder[]> {
    return folderId
      ? this.folders.getFolderContents(folderId, 0, 1).pipe(map((c) => c.breadcrumb))
      : of([]);
  }
}
