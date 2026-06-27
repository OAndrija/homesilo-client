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

export interface MovePayload {
  fileIds: string[];
  folderIds: string[];
  targetFolderId: string;
}

@Component({
  selector: 'app-file-table',
  imports: [DatePipe],
  templateUrl: './file-table.html',
  styleUrl: './file-table.css',
})
export class FileTable {
  private elementRef = inject(ElementRef);

  files = input.required<FileMetadata[]>();
  actions = input<FileAction[]>(['download', 'trash', 'star']);
  dateColumnLabel = input('Uploaded');
  download = output<FileMetadata>();
  trash = output<FileMetadata>();
  star = output<FileMetadata>();
  restore = output<FileMetadata>();
  deleteForever = output<FileMetadata>();
  openFile = output<FileMetadata>();

  folders = input<Folder[]>([]);
  folderOpen = output<Folder>();
  folderTrash = output<Folder>();
  folderRestore = output<Folder>(); // ← add this
  folderDeleteForever = output<Folder>();
  itemsMoved = output<MovePayload>();

  errorRowId = signal<string | null>(null);
  private errorTimeout?: ReturnType<typeof setTimeout>;

  selectedIds = signal<Set<string>>(new Set());
  selectedFolderIds = signal<Set<string>>(new Set());
  private lastClickedIndex: number | null = null;
  private lastClickedFolderIndex: number | null = null;

  // ── Drag state ────────────────────────────────────────────────
  dragOverFolderId = signal<string | null>(null);
  private dragPayload: { fileIds: string[]; folderIds: string[] } | null = null;

  constructor() {
    effect(() => {
      const currentFileIds = new Set(this.files().map((f) => f.id));
      this.selectedIds.update((selected) => {
        const pruned = new Set([...selected].filter((id) => currentFileIds.has(id)));
        return pruned.size !== selected.size ? pruned : selected;
      });
    });

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

  // ── Drag handlers ─────────────────────────────────────────────

  onFileDragStart(file: FileMetadata, event: DragEvent): void {
    // If the dragged file isn't selected, drag just it; otherwise drag all selected
    const fileIds = this.selectedIds().has(file.id) ? [...this.selectedIds()] : [file.id];
    const folderIds = this.selectedIds().has(file.id) ? [...this.selectedFolderIds()] : [];

    this.dragPayload = { fileIds, folderIds };
    event.dataTransfer!.effectAllowed = 'move';
    event.dataTransfer!.setData('text/plain', 'items');
  }

  onFolderDragStart(folder: Folder, event: DragEvent): void {
    // If the dragged folder isn't selected, drag just it; otherwise drag all selected
    const folderIds = this.selectedFolderIds().has(folder.id)
      ? [...this.selectedFolderIds()]
      : [folder.id];
    const fileIds = this.selectedFolderIds().has(folder.id) ? [...this.selectedIds()] : [];

    this.dragPayload = { fileIds, folderIds };
    event.dataTransfer!.effectAllowed = 'move';
    event.dataTransfer!.setData('text/plain', 'items');
  }

  onFolderDragOver(folder: Folder, event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    // Don't allow dropping onto a folder that is being dragged
    if (this.dragPayload?.folderIds.includes(folder.id)) {
      event.dataTransfer!.dropEffect = 'none';
      return;
    }

    event.dataTransfer!.dropEffect = 'move';
    this.dragOverFolderId.set(folder.id);
  }

  onFolderDragLeave(event: DragEvent): void {
    event.stopPropagation();
    this.dragOverFolderId.set(null);
  }

  onFolderDrop(folder: Folder, event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOverFolderId.set(null);

    if (!this.dragPayload) return;

    // Guard: don't drop a folder into itself
    if (this.dragPayload.folderIds.includes(folder.id)) {
      this.dragPayload = null;
      return;
    }

    this.itemsMoved.emit({
      fileIds: this.dragPayload.fileIds,
      folderIds: this.dragPayload.folderIds,
      targetFolderId: folder.id,
    });

    this.dragPayload = null;
  }

  onDragEnd(): void {
    this.dragOverFolderId.set(null);
    this.dragPayload = null;
  }

  // ── Selection handlers ────────────────────────────────────────

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
      this.lastClickedFolderIndex = index;
      return;
    }

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
      this.lastClickedIndex = index;
      return;
    }

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
