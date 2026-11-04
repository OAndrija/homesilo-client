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
import { getFileIcon } from '../../core/utils/file-icon.util';
import { isPreviewable } from '../../core/utils/file-preview.utils';
import { formatBytes } from '../../core/utils/format';
import { ExactDatePipe, FriendlyDatePipe } from '../pipes/friendly-date';

export type FileAction =
  | 'download'
  | 'rename'
  | 'move'
  | 'trash'
  | 'restore'
  | 'deleteForever'
  | 'star';

export interface MovePayload {
  fileIds: string[];
  folderIds: string[];
  targetFolderId: string;
}

type MenuTarget = { kind: 'file'; item: FileMetadata } | { kind: 'folder'; item: Folder };

const MENU_HEIGHT_ESTIMATE = 300;

@Component({
  selector: 'app-file-table',
  imports: [FriendlyDatePipe, ExactDatePipe],
  templateUrl: './file-table.html',
  styleUrl: './file-table.css',
})
export class FileTable {
  private elementRef = inject(ElementRef<HTMLElement>);

  files = input.required<FileMetadata[]>();
  folders = input<Folder[]>([]);
  actions = input<FileAction[]>(['download', 'trash', 'star']);
  dateColumnLabel = input('Modified');
  /** Show a checkbox column and allow multi-select. */
  selectable = input(true);

  // File events
  openFile = output<FileMetadata>();
  download = output<FileMetadata>();
  rename = output<FileMetadata>();
  trash = output<FileMetadata>();
  star = output<FileMetadata>();
  restore = output<FileMetadata>();
  deleteForever = output<FileMetadata>();

  // Folder events
  folderOpen = output<Folder>();
  folderDownload = output<Folder>();
  folderRename = output<Folder>();
  folderTrash = output<Folder>();
  folderRestore = output<Folder>();
  folderDeleteForever = output<Folder>();

  /** The selection now holds just the item; the page opens its move dialog. */
  moveRequested = output<void>();
  itemsMoved = output<MovePayload>();

  errorRowId = signal<string | null>(null);
  private errorTimeout?: ReturnType<typeof setTimeout>;

  selectedIds = signal<Set<string>>(new Set());
  selectedFolderIds = signal<Set<string>>(new Set());
  private lastClickedIndex: number | null = null;
  private lastClickedFolderIndex: number | null = null;

  menu = signal<{ id: string; up: boolean } | null>(null);

  dragOverFolderId = signal<string | null>(null);
  private dragPayload: { fileIds: string[]; folderIds: string[] } | null = null;

  totalCount = computed(() => this.files().length + this.folders().length);
  selectedCount = computed(() => this.selectedIds().size + this.selectedFolderIds().size);
  allSelected = computed(() => this.totalCount() > 0 && this.selectedCount() === this.totalCount());
  someSelected = computed(() => this.selectedCount() > 0 && !this.allSelected());

  readonly getFileIcon = getFileIcon;
  readonly formatSize = formatBytes;
  readonly isPreviewable = isPreviewable;

  constructor() {
    // Drop selections that no longer exist (deleted, moved, filtered out).
    effect(() => {
      const ids = new Set(this.files().map((f) => f.id));
      this.selectedIds.update((s) => prune(s, ids));
    });
    effect(() => {
      const ids = new Set(this.folders().map((f) => f.id));
      this.selectedFolderIds.update((s) => prune(s, ids));
    });
  }

  hasAction(action: FileAction): boolean {
    return this.actions().includes(action);
  }

  isSelected(fileId: string): boolean {
    return this.selectedIds().has(fileId);
  }

  isFolderSelected(folderId: string): boolean {
    return this.selectedFolderIds().has(folderId);
  }

  flashRowError(fileId: string): void {
    clearTimeout(this.errorTimeout);
    this.errorRowId.set(fileId);
    this.errorTimeout = setTimeout(() => this.errorRowId.set(null), 1200);
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
    this.selectedFolderIds.set(new Set());
    this.lastClickedIndex = null;
    this.lastClickedFolderIndex = null;
  }

  // ── Selection ────────────────────────────────────────────────────────

  toggleAll(): void {
    if (this.allSelected()) {
      this.clearSelection();
      return;
    }
    this.selectedIds.set(new Set(this.files().map((f) => f.id)));
    this.selectedFolderIds.set(new Set(this.folders().map((f) => f.id)));
  }

  toggleFile(file: FileMetadata, index: number): void {
    this.selectedIds.update((s) => toggled(s, file.id));
    this.lastClickedIndex = index;
  }

  toggleFolder(folder: Folder, index: number): void {
    this.selectedFolderIds.update((s) => toggled(s, folder.id));
    this.lastClickedFolderIndex = index;
  }

  onRowClick(file: FileMetadata, index: number, event: MouseEvent): void {
    if (event.shiftKey && this.lastClickedIndex !== null) {
      const ids = rangeIds(this.files(), this.lastClickedIndex, index);
      this.selectedIds.update((s) => new Set([...s, ...ids]));
      return;
    }
    if (event.ctrlKey || event.metaKey) {
      this.toggleFile(file, index);
      return;
    }
    this.selectedIds.set(new Set([file.id]));
    this.selectedFolderIds.set(new Set());
    this.lastClickedIndex = index;
  }

  onFolderClick(folder: Folder, index: number, event: MouseEvent): void {
    if (event.shiftKey && this.lastClickedFolderIndex !== null) {
      const ids = rangeIds(this.folders(), this.lastClickedFolderIndex, index);
      this.selectedFolderIds.update((s) => new Set([...s, ...ids]));
      return;
    }
    if (event.ctrlKey || event.metaKey) {
      this.toggleFolder(folder, index);
      return;
    }
    this.selectedFolderIds.set(new Set([folder.id]));
    this.selectedIds.set(new Set());
    this.lastClickedFolderIndex = index;
  }

  activateFile(file: FileMetadata): void {
    if (this.hasAction('restore')) return; // nothing to open in trash
    this.openFile.emit(file);
  }

  activateFolder(folder: Folder): void {
    if (this.hasAction('restore')) return;
    this.folderOpen.emit(folder);
  }

  // ── Row menu ─────────────────────────────────────────────────────────

  toggleMenu(id: string, event: MouseEvent): void {
    event.stopPropagation();
    if (this.menu()?.id === id) {
      this.menu.set(null);
      return;
    }
    const trigger = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const up =
      window.innerHeight - trigger.bottom < MENU_HEIGHT_ESTIMATE &&
      trigger.top > MENU_HEIGHT_ESTIMATE;
    this.menu.set({ id, up });
  }

  isMenuOpen(id: string): boolean {
    return this.menu()?.id === id;
  }

  /** Runs a menu choice and closes the menu. */
  choose(target: MenuTarget, action: FileAction | 'open'): void {
    this.menu.set(null);
    if (target.kind === 'file') {
      const file = target.item;
      switch (action) {
        case 'open':
          return this.openFile.emit(file);
        case 'download':
          return this.download.emit(file);
        case 'rename':
          return this.rename.emit(file);
        case 'star':
          return this.star.emit(file);
        case 'trash':
          return this.trash.emit(file);
        case 'restore':
          return this.restore.emit(file);
        case 'deleteForever':
          return this.deleteForever.emit(file);
        case 'move':
          this.selectedIds.set(new Set([file.id]));
          this.selectedFolderIds.set(new Set());
          return this.moveRequested.emit();
      }
    } else {
      const folder = target.item;
      switch (action) {
        case 'open':
          return this.folderOpen.emit(folder);
        case 'download':
          return this.folderDownload.emit(folder);
        case 'rename':
          return this.folderRename.emit(folder);
        case 'trash':
          return this.folderTrash.emit(folder);
        case 'restore':
          return this.folderRestore.emit(folder);
        case 'deleteForever':
          return this.folderDeleteForever.emit(folder);
        case 'move':
          this.selectedFolderIds.set(new Set([folder.id]));
          this.selectedIds.set(new Set());
          return this.moveRequested.emit();
      }
    }
  }

  // ── Drag and drop onto folders ───────────────────────────────────────

  onFileDragStart(file: FileMetadata, event: DragEvent): void {
    const dragSelection = this.selectedIds().has(file.id);
    this.dragPayload = {
      fileIds: dragSelection ? [...this.selectedIds()] : [file.id],
      folderIds: dragSelection ? [...this.selectedFolderIds()] : [],
    };
    this.startDrag(event);
  }

  onFolderDragStart(folder: Folder, event: DragEvent): void {
    const dragSelection = this.selectedFolderIds().has(folder.id);
    this.dragPayload = {
      fileIds: dragSelection ? [...this.selectedIds()] : [],
      folderIds: dragSelection ? [...this.selectedFolderIds()] : [folder.id],
    };
    this.startDrag(event);
  }

  onFolderDragOver(folder: Folder, event: DragEvent): void {
    if (!this.dragPayload) return; // external files are handled by the page (upload)
    event.preventDefault();
    event.stopPropagation();
    const self = this.dragPayload.folderIds.includes(folder.id);
    event.dataTransfer!.dropEffect = self ? 'none' : 'move';
    this.dragOverFolderId.set(self ? null : folder.id);
  }

  onFolderDragLeave(event: DragEvent): void {
    event.stopPropagation();
    this.dragOverFolderId.set(null);
  }

  onFolderDrop(folder: Folder, event: DragEvent): void {
    if (!this.dragPayload) return;
    event.preventDefault();
    event.stopPropagation();
    this.dragOverFolderId.set(null);
    if (!this.dragPayload.folderIds.includes(folder.id)) {
      this.itemsMoved.emit({ ...this.dragPayload, targetFolderId: folder.id });
    }
    this.dragPayload = null;
  }

  onDragEnd(): void {
    this.dragOverFolderId.set(null);
    this.dragPayload = null;
  }

  private startDrag(event: DragEvent): void {
    this.menu.set(null);
    event.dataTransfer!.effectAllowed = 'move';
    event.dataTransfer!.setData('text/plain', 'homesilo-items');
  }

  // ── Dismissal ────────────────────────────────────────────────────────

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Element;
    if (!target.closest?.('.row-menu')) this.menu.set(null);
    const keepSelection =
      this.elementRef.nativeElement.contains(target) ||
      !!target.closest?.('[data-selection-bar], [data-dialog-backdrop], app-toast-host');
    if (!keepSelection) this.clearSelection();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.menu()) this.menu.set(null);
    else this.clearSelection();
  }
}

function prune(selected: Set<string>, existing: Set<string>): Set<string> {
  const next = new Set([...selected].filter((id) => existing.has(id)));
  return next.size !== selected.size ? next : selected;
}

function toggled(selected: Set<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

function rangeIds<T extends { id: string }>(list: T[], from: number, to: number): string[] {
  return list.slice(Math.min(from, to), Math.max(from, to) + 1).map((x) => x.id);
}
