import { Component, ElementRef, HostListener, inject, input, output, signal, effect } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FileMetadata } from '../../core/models/file-metadata';
import { getFileIcon } from '../../core/utils/file-icon.util';

export type FileAction = 'download' | 'trash' | 'restore' | 'deleteForever' | 'star';

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

  errorRowId = signal<string | null>(null);
  private errorTimeout?: ReturnType<typeof setTimeout>;

  selectedIds = signal<Set<string>>(new Set());
  private lastClickedIndex: number | null = null;

  constructor() {
    effect(() => {
      const currentIds = new Set(this.files().map((f) => f.id));
      this.selectedIds.update((selected) => {
        const pruned = new Set([...selected].filter((id) => currentIds.has(id)));
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
        if (next.has(file.id)) {
          next.delete(file.id);
        } else {
          next.add(file.id);
        }
        return next;
      });
      this.lastClickedIndex = index;
      return;
    }

    this.selectedIds.set(new Set([file.id]));
    this.lastClickedIndex = index;
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
    this.lastClickedIndex = null;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node;
    const clickedInsideTable = this.elementRef.nativeElement.contains(target);
    const clickedInsideBar = !!(target as Element).closest?.('[data-selection-bar]');
    if (!clickedInsideTable && !clickedInsideBar) {
      this.selectedIds.set(new Set());
      this.lastClickedIndex = null;
    }
  }
}
