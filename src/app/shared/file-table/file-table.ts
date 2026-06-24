import {
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
  effect,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FileMetadata } from '../../core/models/file-metadata';
import { getFileIcon } from '../../core/utils/file-icon.util';
import { Folder } from '../../core/models/folder';

export type FileAction = 'download' | 'trash' | 'restore' | 'deleteForever' | 'star';

@Component({
  selector: 'app-file-table',
  imports: [DatePipe],
  templateUrl: './file-table.html',
  styleUrl: './file-table.css',
})
export class FileTable {
  private elementRef = inject(ElementRef);

  // File inputs / outputs
  files = input.required<FileMetadata[]>();
  actions = input<FileAction[]>(['download', 'trash', 'star']);
  dateColumnLabel = input('Uploaded');
  download = output<FileMetadata>();
  trash = output<FileMetadata>();
  star = output<FileMetadata>();
  restore = output<FileMetadata>();
  deleteForever = output<FileMetadata>();
  openFile = output<FileMetadata>();

  // Folder inputs / outputs
  folders = input<Folder[]>([]);
  folderOpen = output<Folder>();
  folderTrash = output<Folder>();

  errorRowId = signal<string | null>(null);
  private errorTimeout?: ReturnType<typeof setTimeout>;

  selectedIds = signal<Set<string>>(new Set());
  selectedFolderIds = signal<Set<string>>(new Set());
  private lastClickedIndex: number | null = null;
  private lastClickedFolderIndex: number | null = null;

  constructor() {
    // Prune selected file IDs when the file list changes
    effect(() => {
      const currentFileIds = new Set(this.files().map((f) => f.id));
      this.selectedIds.update((selected) => {
        const pruned = new Set([...selected].filter((id) => currentFileIds.has(id)));
        return pruned.size !== selected.size ? pruned : selected;
      });
    });

    // Prune selected folder IDs when the folder list changes
    effect(() => {
      const currentFolderIds = new Set(this.folders().map((f) => f.id));
      this.selectedFolderIds.update((selected) => {
        const pruned = new Set([...selected].filter((id) => currentFolderIds.has(id)));
        return pruned.size !== selected.size ? pruned : selected;
      });
    });
  }

  hasAction(action: FileAction): boolean {
    return this.actions().includes(action);
  }

  getFileIcon = getFileIcon;

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
    return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  }

  flashRowError(fileId: string): void {
    clearTimeout(this.errorTimeout);
    this.errorRowId.set(fileId);
    this.errorTimeout = setTimeout(() => this.errorRowId.set(null), 1200);
  }

  isSelected(fileId: string): boolean {
    return this.selectedIds().has(fileId);
  }

  isFolderSelected(folderId: string): boolean {
    return this.selectedFolderIds().has(folderId);
  }

  onFolderClick(folder: Folder, index: number, event: MouseEvent): void {
    event.stopPropagation();
    const isToggle = event.ctrlKey || event.metaKey;
    const isRange = event.shiftKey;

    if (isRange && this.lastClickedFolderIndex !== null) {
      const list = this.folders();
      const start = Math.min(this.lastClickedFolderIndex, index);
      const end = Math.max(this.lastClickedFolderIndex, index);
      const rangeIds = list.slice(start, end + 1).map((f) => f.id);
      this.selectedFolderIds.update((current) => {
        const next = new Set(current);
        rangeIds.forEach((id) => next.add(id));
        return next;
      });
      return;
    }

    if (isToggle) {
      this.selectedFolderIds.update((current) => {
        const next = new Set(current);
        if (next.has(folder.id)) next.delete(folder.id);
        else next.add(folder.id);
        return next;
      });
      // do NOT touch selectedIds — preserve file selection on Ctrl+click
      this.lastClickedFolderIndex = index;
      return;
    }

    // Plain click — select only this folder, clear everything else
    this.selectedFolderIds.set(new Set([folder.id]));
    this.selectedIds.set(new Set());
    this.lastClickedFolderIndex = index;
  }

  onRowClick(file: FileMetadata, index: number, event: MouseEvent): void {
    const isToggle = event.ctrlKey || event.metaKey;
    const isRange = event.shiftKey;

    if (isRange && this.lastClickedIndex !== null) {
      const list = this.files();
      const start = Math.min(this.lastClickedIndex, index);
      const end = Math.max(this.lastClickedIndex, index);
      const rangeIds = list.slice(start, end + 1).map((f) => f.id);
      this.selectedIds.update((current) => {
        const next = new Set(current);
        rangeIds.forEach((id) => next.add(id));
        return next;
      });
      return;
    }

    if (isToggle) {
      this.selectedIds.update((current) => {
        const next = new Set(current);
        if (next.has(file.id)) next.delete(file.id);
        else next.add(file.id);
        return next;
      });
      // do NOT touch selectedFolderIds — preserve folder selection on Ctrl+click
      this.lastClickedIndex = index;
      return;
    }

    // Plain click — select only this file, clear everything else
    this.selectedIds.set(new Set([file.id]));
    this.selectedFolderIds.set(new Set());
    this.lastClickedIndex = index;
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
    this.selectedFolderIds.set(new Set());
    this.lastClickedIndex = null;
    this.lastClickedFolderIndex = null;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node;
    const clickedInsideTable = this.elementRef.nativeElement.contains(target);
    const clickedInsideBar = !!(target as Element).closest?.('[data-selection-bar]');
    const clickedInsideFolderPickerDialog = !!(target as Element).closest?.(
      '[data-dialog-backdrop]',
    );
    if (!clickedInsideTable && !clickedInsideBar && !clickedInsideFolderPickerDialog) {
      this.selectedIds.set(new Set());
      this.lastClickedIndex = null;
    }
  }
}
