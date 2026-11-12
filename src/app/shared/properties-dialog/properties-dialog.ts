import { DecimalPipe } from '@angular/common';
import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, map, Observable, of } from 'rxjs';
import { errorMessage } from '../../core/http/http-error';
import { FileMetadata } from '../../core/models/file-metadata';
import { Folder, FolderSummary } from '../../core/models/folder';
import { FileActions } from '../../core/services/file-actions';
import { Files } from '../../core/services/files';
import { Folders } from '../../core/services/folders';
import { PropertiesService } from '../../core/services/properties';
import { describeKind } from '../../core/utils/file-kind';
import { getFileIcon } from '../../core/utils/file-icon.util';
import { formatBytes } from '../../core/utils/format';
import { ExactDatePipe } from '../pipes/friendly-date';

interface FileDetails {
  kind: 'file';
  file: FileMetadata;
  /** Folders from the top of My Files down to the one holding the file. */
  path: Folder[];
}

interface FolderDetails {
  kind: 'folder';
  folder: Folder;
  /** Folders above this one, from the top. */
  path: Folder[];
  summary: FolderSummary;
}

/**
 * Properties of a file or folder: what it is, how big, where it lives and when it
 * changed. Opened from the row and tile menus and from the file viewer.
 */
@Component({
  selector: 'app-properties-dialog',
  imports: [ExactDatePipe, DecimalPipe],
  templateUrl: './properties-dialog.html',
  styleUrls: ['../dialog/dialog.css', './properties-dialog.css'],
})
export class PropertiesDialog {
  private properties = inject(PropertiesService);
  private files = inject(Files);
  private folders = inject(Folders);
  private fileActions = inject(FileActions);
  private router = inject(Router);

  target = this.properties.target;
  details = signal<FileDetails | FolderDetails | null>(null);
  loading = signal(false);
  error = signal('');
  thumbBroken = signal(false);

  private closeButton = viewChild<ElementRef<HTMLButtonElement>>('closeButton');
  /** Where the keyboard was before the dialog opened, to go back there after. */
  private returnFocus: HTMLElement | null = null;

  /** The fresh copy once loaded, the clicked one until then. */
  file = computed(() => {
    const d = this.details();
    if (d?.kind === 'file') return d.file;
    const t = this.target();
    return t?.kind === 'file' ? t.item : null;
  });
  folder = computed(() => {
    const d = this.details();
    if (d?.kind === 'folder') return d.folder;
    const t = this.target();
    return t?.kind === 'folder' ? t.item : null;
  });
  name = computed(() => this.file()?.originalFileName ?? this.folder()?.name ?? '');
  kind = computed(() => {
    const file = this.file();
    return file ? describeKind(file.originalFileName, file.contentType) : 'Folder';
  });
  icon = computed(() => {
    const file = this.file();
    return file
      ? getFileIcon(file.originalFileName)
      : { icon: 'folder', color: 'var(--color-accent)' };
  });
  thumbnail = computed(() => {
    const file = this.file();
    return file?.thumbnail && !this.thumbBroken() ? this.files.thumbnailUrl(file.id) : null;
  });
  trashed = computed(() => this.file()?.trashed ?? this.folder()?.trashed ?? false);
  path = computed(() => this.details()?.path ?? []);
  summary = computed(() => {
    const d = this.details();
    return d?.kind === 'folder' ? d.summary : null;
  });

  constructor() {
    effect(() => {
      const target = this.target();
      untracked(() => {
        this.details.set(null);
        this.error.set('');
        this.thumbBroken.set(false);
        if (!target) return;
        this.returnFocus = document.activeElement as HTMLElement | null;
        setTimeout(() => this.closeButton()?.nativeElement.focus());
        this.load(target);
      });
    });
  }

  private load(target: NonNullable<ReturnType<typeof this.target>>): void {
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
        if (this.target() !== target) return;
        if (details.kind === 'file' && details.file.folderId) {
          this.pathOf(details.file.folderId).subscribe((path) => {
            if (this.target() === target) this.details.set({ ...details, path });
          });
        }
        this.details.set(details);
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

  close(): void {
    this.properties.close();
    const back = this.returnFocus;
    this.returnFocus = null;
    if (back?.isConnected) setTimeout(() => back.focus({ preventScroll: true }));
  }

  openFile(): void {
    const file = this.file();
    if (!file) return;
    this.close();
    this.fileActions.open(file);
  }

  download(): void {
    const file = this.file();
    if (file) this.fileActions.download(file);
  }

  /** Opens a folder of the location (or, for a folder, the folder itself) in My Files. */
  goTo(folderId: string | null): void {
    this.properties.close();
    this.returnFocus = null;
    void this.router.navigate(['/my-files'], {
      queryParams: folderId ? { folderId } : {},
    });
  }

  formatBytes = formatBytes;

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as Element).classList.contains('dialog-backdrop')) this.close();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    // The viewer behind may also close on Escape; this one is for the dialog.
    event.stopPropagation();
    this.close();
  }
}
