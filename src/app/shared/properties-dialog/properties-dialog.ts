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
import { FileActions } from '../../core/services/file-actions';
import { Files } from '../../core/services/files';
import { PropertiesService } from '../../core/services/properties';
import { describeKind } from '../../core/utils/file-kind';
import { getFileIcon } from '../../core/utils/file-icon.util';
import { FileDetails, FolderDetails, ItemDetails } from '../item-details/item-details';

/**
 * Properties of a file or folder from a list: what it is, how big, where it
 * lives and when it changed, with Open and Download at hand. (The file viewer
 * has its own details panel, without those buttons.)
 */
@Component({
  selector: 'app-properties-dialog',
  imports: [ItemDetails],
  templateUrl: './properties-dialog.html',
  styleUrls: ['../dialog/dialog.css', './properties-dialog.css'],
})
export class PropertiesDialog {
  private properties = inject(PropertiesService);
  private files = inject(Files);
  private fileActions = inject(FileActions);
  private router = inject(Router);

  target = this.properties.target;
  /** The fresh copy from the details, once they've loaded. */
  loaded = signal<FileDetails | FolderDetails | null>(null);
  thumbBroken = signal(false);

  private closeButton = viewChild<ElementRef<HTMLButtonElement>>('closeButton');
  /** Where the keyboard was before the dialog opened, to go back there after. */
  private returnFocus: HTMLElement | null = null;

  file = computed(() => {
    const d = this.loaded();
    if (d?.kind === 'file') return d.file;
    const t = this.target();
    return t?.kind === 'file' ? t.item : null;
  });
  folder = computed(() => {
    const d = this.loaded();
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

  constructor() {
    effect(() => {
      const target = this.target();
      untracked(() => {
        this.loaded.set(null);
        this.thumbBroken.set(false);
        if (!target) return;
        this.returnFocus = document.activeElement as HTMLElement | null;
        setTimeout(() => this.closeButton()?.nativeElement.focus());
      });
    });
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
