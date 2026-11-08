import { Component, inject, input, output, signal } from '@angular/core';
import { Folders } from '../../core/services/folders';
import { Folder } from '../../core/models/folder';

@Component({
  selector: 'app-folder-picker-dialog',
  templateUrl: './folder-picker-dialog.html',
  styleUrl: './folder-picker-dialog.css',
})
export class FolderPickerDialog {
  private folderService = inject(Folders);

  excludedFolderIds = input<string[]>([]);
  confirm = output<string | null>();
  cancel = output<void>();

  currentFolder = signal<Folder | null>(null);
  breadcrumb = signal<Folder[]>([]);
  subfolders = signal<Folder[]>([]);
  loading = signal(false);

  constructor() {
    this.loadLevel(null);
  }

  loadLevel(folderId: string | null): void {
    this.loading.set(true);
    const request$ =
      folderId === null
        ? this.folderService.getRootContents(0, 100)
        : this.folderService.getFolderContents(folderId, 0, 100);

    request$.subscribe({
      next: (response) => {
        this.currentFolder.set(response.folder);
        this.breadcrumb.set(response.breadcrumb ?? []);
        // Filter out folders being moved — can't move a folder into itself
        this.subfolders.set(
          response.subfolders.filter((f) => !this.excludedFolderIds().includes(f.id)),
        );
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  navigateTo(folder: Folder): void {
    this.loadLevel(folder.id);
  }

  navigateToBreadcrumb(folder: Folder | null): void {
    this.loadLevel(folder?.id ?? null);
  }

  moveHere(): void {
    this.confirm.emit(this.currentFolder()?.id ?? null);
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as Element).classList.contains('dialog-backdrop')) {
      this.cancel.emit();
    }
  }
}
