import { PropertiesService } from '../../core/services/properties';
import {
  Component,
  computed,
  effect,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FileMetadata } from '../../core/models/file-metadata';
import { Folder } from '../../core/models/folder';
import { Files } from '../../core/services/files';
import { getFileIcon } from '../../core/utils/file-icon.util';
import { formatBytes } from '../../core/utils/format';
import { FileAction, MovePayload } from '../file-table/file-table';
import { NgTemplateOutlet } from '@angular/common';
import { ExactDatePipe, FriendlyDatePipe } from '../pipes/friendly-date';

export type MenuTarget = { kind: 'file'; item: FileMetadata } | { kind: 'folder'; item: Folder };

/**
 * Files as tiles with image previews: folders first as compact cards, then a tile
 * per file. It has the same inputs, outputs and selection as FileTable, so a page
 * can switch between the two without changing anything else.
 */
@Component({
  selector: 'app-file-grid',
  imports: [FriendlyDatePipe, ExactDatePipe, NgTemplateOutlet],
  templateUrl: './file-grid.html',
  styleUrl: './file-grid.css',
  host: { '[class.has-selection]': 'selectedCount() > 0' },
})
export class FileGrid {
  protected properties = inject(PropertiesService);
  private elementRef: ElementRef<HTMLElement> = inject(ElementRef);
  private filesApi = inject(Files);

  files = input.required<FileMetadata[]>();
  folders = input<Folder[]>([]);
  actions = input<FileAction[]>(['download', 'trash', 'star']);
  selectable = input(true);

  download = output<FileMetadata>();
  rename = output<FileMetadata>();
  trash = output<FileMetadata>();
  star = output<FileMetadata>();
  restore = output<FileMetadata>();
  deleteForever = output<FileMetadata>();
  openFile = output<FileMetadata>();

  folderOpen = output<Folder>();
  folderDownload = output<Folder>();
  folderRename = output<Folder>();
  folderTrash = output<Folder>();
  folderStar = output<Folder>();
  folderRestore = output<Folder>();
  folderDeleteForever = output<Folder>();
  itemsMoved = output<MovePayload>();

  getFileIcon = getFileIcon;
  formatBytes = formatBytes;

  // ── Selection (same model as FileTable) ──────────────────────
  selectedIds = signal<Set<string>>(new Set());
  selectedFolderIds = signal<Set<string>>(new Set());
  selectedCount = computed(() => this.selectedIds().size + this.selectedFolderIds().size);
  private lastFileIndex: number | null = null;
  private lastFolderIndex: number | null = null;

  /** Previews that failed to load show the file-type icon instead. */
  brokenThumbs = signal<Set<string>>(new Set());
  menu = signal<MenuTarget | null>(null);
  dragOverFolderId = signal<string | null>(null);
  private dragPayload: { fileIds: string[]; folderIds: string[] } | null = null;

  constructor() {
    // Drop selections of items that are no longer shown.
    effect(() => {
      const ids = new Set(this.files().map((f) => f.id));
      this.selectedIds.update((s) => pruned(s, ids));
    });
    effect(() => {
      const ids = new Set(this.folders().map((f) => f.id));
      this.selectedFolderIds.update((s) => pruned(s, ids));
    });
  }

  hasAction(action: FileAction): boolean {
    return this.actions().includes(action);
  }

  thumbnailUrl(file: FileMetadata): string | null {
    return file.thumbnail && !this.brokenThumbs().has(file.id)
      ? this.filesApi.thumbnailUrl(file.id)
      : null;
  }

  onThumbError(file: FileMetadata): void {
    this.brokenThumbs.update((s) => new Set(s).add(file.id));
  }

  extension(file: FileMetadata): string {
    const dot = file.originalFileName.lastIndexOf('.');
    return dot > 0 ? file.originalFileName.slice(dot + 1).toUpperCase() : '';
  }

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  isFolderSelected(id: string): boolean {
    return this.selectedFolderIds().has(id);
  }

  // ── Pointer and keyboard ─────────────────────────────────────

  onFileClick(file: FileMetadata, index: number, event: MouseEvent): void {
    event.stopPropagation();
    if (event.shiftKey && this.lastFileIndex !== null) {
      const [a, b] = [Math.min(this.lastFileIndex, index), Math.max(this.lastFileIndex, index)];
      const range = this.files()
        .slice(a, b + 1)
        .map((f) => f.id);
      this.selectedIds.update((s) => new Set([...s, ...range]));
      return;
    }
    if (event.ctrlKey || event.metaKey) {
      this.toggleFile(file, index);
      return;
    }
    this.selectedIds.set(new Set([file.id]));
    this.selectedFolderIds.set(new Set());
    this.lastFileIndex = index;
  }

  onFolderClick(folder: Folder, index: number, event: MouseEvent): void {
    event.stopPropagation();
    if (event.shiftKey && this.lastFolderIndex !== null) {
      const [a, b] = [Math.min(this.lastFolderIndex, index), Math.max(this.lastFolderIndex, index)];
      const range = this.folders()
        .slice(a, b + 1)
        .map((f) => f.id);
      this.selectedFolderIds.update((s) => new Set([...s, ...range]));
      return;
    }
    if (event.ctrlKey || event.metaKey) {
      this.toggleFolder(folder, index);
      return;
    }
    this.selectedFolderIds.set(new Set([folder.id]));
    this.selectedIds.set(new Set());
    this.lastFolderIndex = index;
  }

  toggleFile(file: FileMetadata, index: number): void {
    this.selectedIds.update((s) => toggled(s, file.id));
    this.lastFileIndex = index;
  }

  toggleFolder(folder: Folder, index: number): void {
    this.selectedFolderIds.update((s) => toggled(s, folder.id));
    this.lastFolderIndex = index;
  }

  /** Enter opens, Space selects: the usual keys for a list of items. */
  onFileKeydown(file: FileMetadata, index: number, event: KeyboardEvent): void {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' && event.altKey) {
      // Alt+Enter: properties, as on the desktop.
      event.preventDefault();
      this.properties.showFile(file);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.openFile.emit(file);
    } else if (event.key === ' ' && this.selectable()) {
      event.preventDefault();
      this.toggleFile(file, index);
    }
  }

  onFolderKeydown(folder: Folder, index: number, event: KeyboardEvent): void {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' && event.altKey) {
      event.preventDefault();
      this.properties.showFolder(folder);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.folderOpen.emit(folder);
    } else if (event.key === ' ' && this.selectable()) {
      event.preventDefault();
      this.toggleFolder(folder, index);
    }
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
    this.selectedFolderIds.set(new Set());
    this.lastFileIndex = null;
    this.lastFolderIndex = null;
  }

  // ── Item menu ────────────────────────────────────────────────

  openMenu(target: MenuTarget, event: MouseEvent): void {
    event.stopPropagation();
    const current = this.menu();
    this.menu.set(current?.item.id === target.item.id ? null : target);
    if (this.menu()) {
      setTimeout(() =>
        this.elementRef.nativeElement
          .querySelector<HTMLElement>('.tile-menu [role="menuitem"]')
          ?.focus(),
      );
    }
  }

  isMenuOpen(id: string): boolean {
    return this.menu()?.item.id === id;
  }

  closeMenu(returnFocus = false): void {
    const open = this.menu();
    this.menu.set(null);
    if (returnFocus && open) {
      this.elementRef.nativeElement
        .querySelector<HTMLElement>(`[data-menu-for="${open.item.id}"]`)
        ?.focus();
    }
  }

  onMenuKeydown(event: KeyboardEvent): void {
    const items = Array.from(
      (event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role="menuitem"]'),
    );
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      items[(index + step + items.length) % items.length]?.focus();
    } else if (event.key === 'Escape') {
      event.stopPropagation();
      this.closeMenu(true);
    } else if (event.key === 'Tab') {
      this.closeMenu();
    }
  }

  /** Runs a menu item: closes the menu, then tells the page. */
  run(action: FileAction | 'open', target: MenuTarget): void {
    this.closeMenu();
    if (target.kind === 'folder') {
      const folder = target.item;
      const outputs = {
        open: this.folderOpen,
        download: this.folderDownload,
        rename: this.folderRename,
        star: this.folderStar,
        restore: this.folderRestore,
        trash: this.folderTrash,
        deleteForever: this.folderDeleteForever,
      };
      outputs[action].emit(folder);
    } else {
      const file = target.item;
      const outputs = {
        open: this.openFile,
        download: this.download,
        rename: this.rename,
        star: this.star,
        restore: this.restore,
        trash: this.trash,
        deleteForever: this.deleteForever,
      };
      outputs[action].emit(file);
    }
  }

  // ── Drag files and folders onto a folder ─────────────────────

  onDragStart(kind: 'file' | 'folder', id: string, event: DragEvent): void {
    const selected = kind === 'file' ? this.isSelected(id) : this.isFolderSelected(id);
    this.dragPayload = selected
      ? { fileIds: [...this.selectedIds()], folderIds: [...this.selectedFolderIds()] }
      : kind === 'file'
        ? { fileIds: [id], folderIds: [] }
        : { fileIds: [], folderIds: [id] };
    event.dataTransfer!.effectAllowed = 'move';
    event.dataTransfer!.setData('text/plain', 'items');
  }

  onFolderDragOver(folder: Folder, event: DragEvent): void {
    if (!this.dragPayload) return;
    event.preventDefault();
    event.stopPropagation();
    if (this.dragPayload.folderIds.includes(folder.id)) {
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
    const payload = this.dragPayload;
    this.dragPayload = null;
    if (!payload || payload.folderIds.includes(folder.id)) return;
    this.itemsMoved.emit({ ...payload, targetFolderId: folder.id });
  }

  onDragEnd(): void {
    this.dragOverFolderId.set(null);
    this.dragPayload = null;
  }

  // ── Clicking elsewhere ───────────────────────────────────────

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Element;
    if (!target.closest?.('.tile-menu')) this.menu.set(null);
    const inside = this.elementRef.nativeElement.contains(target);
    const inBar = !!target.closest?.('[data-selection-bar]');
    const inDialog = !!target.closest?.('[data-dialog-backdrop]');
    if (!inside && !inBar && !inDialog) this.clearSelection();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.menu.set(null);
  }
}

function toggled(selected: Set<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

function pruned(selected: Set<string>, present: Set<string>): Set<string> {
  const next = new Set([...selected].filter((id) => present.has(id)));
  return next.size !== selected.size ? next : selected;
}
