import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Folder } from '../../core/models/folder';
import { Folders } from '../../core/services/folders';

@Component({
  selector: 'app-folder-picker-dialog',
  templateUrl: './folder-picker-dialog.html',
  styleUrls: ['../dialog/dialog.css', './folder-picker-dialog.css'],
})
export class FolderPickerDialog {
  private folderService = inject(Folders);

  /** Folders being moved: they (and so their subfolders) can't be a destination. */
  excludedFolderIds = input<string[]>([]);
  /** Where the items are now (null = My Files); moving there would do nothing. Undefined = mixed. */
  sourceFolderId = input<string | null | undefined>(undefined);
  /** How many items are being moved, for the title. */
  itemCount = input(0);

  confirm = output<string | null>();
  cancel = output<void>();

  currentFolder = signal<Folder | null>(null);
  breadcrumb = signal<Folder[]>([]);
  subfolders = signal<Folder[]>([]);
  loading = signal(false);
  failed = signal(false);

  title = computed(() => {
    const n = this.itemCount();
    return n > 1 ? `Move ${n} items` : n === 1 ? 'Move 1 item' : 'Move to';
  });
  destinationName = computed(() => this.currentFolder()?.name ?? 'My Files');
  isSource = computed(
    () =>
      this.sourceFolderId() !== undefined &&
      (this.currentFolder()?.id ?? null) === this.sourceFolderId(),
  );

  constructor() {
    this.loadLevel(null);
  }

  loadLevel(folderId: string | null): void {
    this.loading.set(true);
    this.failed.set(false);
    const request$ =
      folderId === null
        ? this.folderService.getRootContents(0, 1)
        : this.folderService.getFolderContents(folderId, 0, 1);

    request$.subscribe({
      next: (response) => {
        this.currentFolder.set(response.folder);
        this.breadcrumb.set(response.breadcrumb ?? []);
        this.subfolders.set(
          response.subfolders.filter((f) => !this.excludedFolderIds().includes(f.id)),
        );
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.failed.set(true);
      },
    });
  }

  navigateTo(folder: Folder): void {
    this.loadLevel(folder.id);
  }

  navigateToBreadcrumb(folder: Folder | null): void {
    this.loadLevel(folder?.id ?? null);
  }

  moveHere(): void {
    if (!this.isSource() && !this.loading()) this.confirm.emit(this.currentFolder()?.id ?? null);
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as Element).classList.contains('dialog-backdrop')) {
      this.cancel.emit();
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.cancel.emit();
  }
}
