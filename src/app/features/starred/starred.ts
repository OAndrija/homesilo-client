import { Router, RouterLink } from '@angular/router';
import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { Files } from '../../core/services/files';
import { Folders } from '../../core/services/folders';
import { DashboardStore } from '../../core/services/dashboard-store';
import { Search } from '../../core/services/search';
import { FileMetadata } from '../../core/models/file-metadata';
import { Folder } from '../../core/models/folder';
import { catchError, concatMap, finalize, forkJoin, from, Observable, of } from 'rxjs';
import { FileTable } from '../../shared/file-table/file-table';
import { FileGrid } from '../../shared/file-grid/file-grid';
import {
  FileView,
  loadView,
  saveView,
  ViewControls,
} from '../../shared/view-controls/view-controls';
import { SelectionBar } from '../../shared/selection-bar/selection-bar';
import { LoadingDelayPipe } from '../../shared/pipes/loading-delay';
import { FileActions } from '../../core/services/file-actions';
import { errorMessage } from '../../core/http/http-error';
import { fileSortParam, loadSort, saveSort, SortState, sortFolders } from '../../core/models/sort';
import { ToastService } from '../../core/services/toast';
import { allStarred, Stars } from '../../core/services/stars';
import { TableSkeleton } from '../../shared/table-skeleton/table-skeleton';

@Component({
  selector: 'app-starred',
  imports: [
    FileTable,
    FileGrid,
    ViewControls,
    SelectionBar,
    LoadingDelayPipe,
    RouterLink,
    TableSkeleton,
  ],
  templateUrl: './starred.html',
  styleUrl: './starred.css',
})
export class Starred {
  private fileService = inject(Files);
  private folderService = inject(Folders);
  private fileActions = inject(FileActions);
  private dashboardStore = inject(DashboardStore);
  private searchService = inject(Search);
  private toast = inject(ToastService);
  private stars = inject(Stars);
  private router = inject(Router);

  fileTable = viewChild(FileTable);
  fileGrid = viewChild(FileGrid);
  /** Whichever of the list or the grid is showing; both share the selection API. */
  items = computed(() => this.fileTable() ?? this.fileGrid());
  view = signal<FileView>(loadView('starred'));

  files = signal<FileMetadata[]>([]);
  folders = signal<Folder[]>([]);
  loading = signal(true);
  loadingMore = signal(false);
  errorMessage = signal('');
  currentPage = signal(0);
  hasMore = signal(false);
  sort = signal<SortState>(loadSort('starred'));

  sortedFolders = computed(() => sortFolders(this.folders(), this.sort()));
  isSearching = computed(() => this.searchService.query().trim().length > 0);
  searchText = computed(() => this.searchService.query().trim());
  isEmpty = computed(() => this.files().length === 0 && this.folders().length === 0);

  selectedCount = computed(
    () => (this.items()?.selectedIds().size ?? 0) + (this.items()?.selectedFolderIds().size ?? 0),
  );
  selectionStarred = computed(() => allStarred(this.getSelectedFiles(), this.getSelectedFolders()));

  summary = computed(() => {
    if (this.loading() && this.isEmpty()) return 'Loading…';
    const folderCount = this.folders().length;
    const fileCount = this.files().length;
    const parts: string[] = [];
    if (folderCount > 0) parts.push(`${folderCount} folder${folderCount !== 1 ? 's' : ''}`);
    if (fileCount > 0) parts.push(`${fileCount} file${fileCount !== 1 ? 's' : ''}`);
    if (parts.length > 0) return parts.join(', ');
    return this.isSearching() ? 'No matches' : 'Nothing starred yet';
  });

  clearSearch(): void {
    this.searchService.clear();
  }

  constructor() {
    effect(() => {
      const query = this.searchService.query().trim();
      this.sort(); // reload when the sort changes
      this.load(query);
    });
  }

  setView(view: FileView): void {
    this.items()?.clearSelection();
    this.view.set(view);
    saveView('starred', view);
  }

  onSortChange(sort: SortState): void {
    this.sort.set(sort);
    saveSort('starred', sort);
  }

  private get sortParam(): string {
    return fileSortParam(this.sort());
  }

  /** Starred folders and the first page of starred files, optionally narrowed by search. */
  load(query = this.searchService.query().trim()): void {
    this.loading.set(true);
    this.currentPage.set(0);
    forkJoin({
      files: query
        ? this.fileService.searchStarred(query, 0, 50, this.sortParam)
        : this.fileService.listStarred(0, 50, this.sortParam),
      folders: this.folderService.listStarred(query || undefined),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ files, folders }) => {
          this.files.set(files.content);
          this.hasMore.set(!files.last);
          this.folders.set(folders);
        },
        error: (err) =>
          this.errorMessage.set(
            errorMessage(err, query ? 'Search failed.' : 'Failed to load starred items.'),
          ),
      });
  }

  loadMore(): void {
    const nextPage = this.currentPage() + 1;
    const query = this.searchService.query().trim();
    this.loadingMore.set(true);
    const request$ =
      query === ''
        ? this.fileService.listStarred(nextPage, 50, this.sortParam)
        : this.fileService.searchStarred(query, nextPage, 50, this.sortParam);
    request$.pipe(finalize(() => this.loadingMore.set(false))).subscribe({
      next: (response) => {
        this.files.update((files) => [...files, ...response.content]);
        this.currentPage.set(nextPage);
        this.hasMore.set(!response.last);
      },
      error: (err) =>
        this.errorMessage.set(errorMessage(err, 'Failed to load more starred files.')),
    });
  }

  // ── Single items ─────────────────────────────────────────────

  downloadFile(file: FileMetadata): void {
    this.fileActions.download(file);
  }

  downloadFolder(folder: Folder): void {
    this.fileActions.downloadSelection([], [folder]);
  }

  openFile(file: FileMetadata): void {
    this.fileActions.open(file, this.files());
  }

  openFolder(folder: Folder): void {
    this.router.navigate(['/my-files'], { queryParams: { folderId: folder.id } });
  }

  trashFile(file: FileMetadata): void {
    this.fileService.trash(file.id).subscribe({
      next: () => {
        this.files.update((files) => files.filter((f) => f.id !== file.id));
        this.dashboardStore.refresh();
        this.toast.success(`Moved “${file.originalFileName}” to trash`, {
          label: 'Undo',
          run: () => this.restore([file.id], []),
        });
      },
      error: (err) => this.errorMessage.set(errorMessage(err, 'Failed to move file to trash.')),
    });
  }

  trashFolder(folder: Folder): void {
    this.folderService.trashFolder(folder.id).subscribe({
      next: () => {
        this.folders.update((folders) => folders.filter((f) => f.id !== folder.id));
        this.dashboardStore.refresh();
        this.toast.success(`Moved “${folder.name}” to trash`, {
          label: 'Undo',
          run: () => this.restore([], [folder.id]),
        });
      },
      error: (err) => this.errorMessage.set(errorMessage(err, 'Failed to move folder to trash.')),
    });
  }

  /** Unstarring removes the item from this view, with an undo. */
  toggleStar(file: FileMetadata): void {
    this.fileService.toggleStar(file.id).subscribe({
      next: (updated) => {
        this.files.update((files) => files.filter((f) => f.id !== updated.id));
        this.dashboardStore.silentRefresh();
        this.offerRestar(`“${updated.originalFileName}”`, [updated.id], []);
      },
      error: (err) => this.errorMessage.set(errorMessage(err, 'Failed to update star.')),
    });
  }

  toggleFolderStar(folder: Folder): void {
    this.folderService.toggleStar(folder.id).subscribe({
      next: (updated) => {
        this.folders.update((folders) => folders.filter((f) => f.id !== updated.id));
        this.dashboardStore.silentRefresh();
        this.offerRestar(`“${updated.name}”`, [], [updated.id]);
      },
      error: (err) => this.errorMessage.set(errorMessage(err, 'Failed to update star.')),
    });
  }

  // ── Selection ────────────────────────────────────────────────

  onDownloadAll(): void {
    this.fileActions.downloadSelection(this.getSelectedFiles(), this.getSelectedFolders());
  }

  onTrashAll(): void {
    const files = this.getSelectedFiles();
    const folders = this.getSelectedFolders();
    this.runSequentially(
      [
        ...files.map((f) => this.fileService.trash(f.id)),
        ...folders.map((f) => this.folderService.trashFolder(f.id)),
      ],
      'Some items could not be moved to trash.',
      () => {
        const fileIds = files.map((f) => f.id);
        const folderIds = folders.map((f) => f.id);
        this.files.update((list) => list.filter((f) => !fileIds.includes(f.id)));
        this.folders.update((list) => list.filter((f) => !folderIds.includes(f.id)));
        this.dashboardStore.refresh();
        const count = fileIds.length + folderIds.length;
        this.toast.success(`Moved ${count} item${count === 1 ? '' : 's'} to trash`, {
          label: 'Undo',
          run: () => this.restore(fileIds, folderIds),
        });
      },
    );
  }

  /** Everything here is starred, so this unstars the selection (and it leaves the page). */
  onStarAll(): void {
    this.stars
      .toggleAll(this.getSelectedFiles(), this.getSelectedFolders())
      .pipe(finalize(() => this.dashboardStore.silentRefresh()))
      .subscribe({
        next: (change) => {
          if (change.starred) {
            this.load();
            return;
          }
          const fileIds = change.files.map((f) => f.id);
          const folderIds = change.folders.map((f) => f.id);
          this.files.update((list) => list.filter((f) => !fileIds.includes(f.id)));
          this.folders.update((list) => list.filter((f) => !folderIds.includes(f.id)));
          const count = fileIds.length + folderIds.length;
          this.offerRestar(`${count} item${count === 1 ? '' : 's'}`, fileIds, folderIds);
        },
        error: (err) => {
          this.toast.error(errorMessage(err, 'Couldn’t update every star.'));
          this.load();
        },
      });
  }

  // ── Helpers ──────────────────────────────────────────────────

  private offerRestar(what: string, fileIds: string[], folderIds: string[]): void {
    this.toast.success(`Removed ${what} from Starred`, {
      label: 'Undo',
      run: () =>
        this.runSequentially(
          [
            ...fileIds.map((id) => this.fileService.toggleStar(id)),
            ...folderIds.map((id) => this.folderService.toggleStar(id)),
          ],
          'Couldn’t restore every star.',
          () => {
            this.load();
            this.dashboardStore.silentRefresh();
          },
        ),
    });
  }

  /** Undo for "move to trash". */
  private restore(fileIds: string[], folderIds: string[]): void {
    this.runSequentially(
      [
        ...fileIds.map((id) => this.fileService.restore(id)),
        ...folderIds.map((id) => this.folderService.restoreFolder(id)),
      ],
      'Couldn’t restore everything.',
      () => {
        this.load();
        this.dashboardStore.refresh();
      },
    );
  }

  /** Runs the requests one at a time; on any failure shows it and reloads. */
  private runSequentially(
    requests: Observable<unknown>[],
    failureMessage: string,
    done: () => void,
  ): void {
    if (requests.length === 0) return;
    let firstError: unknown = null;
    from(requests)
      .pipe(
        concatMap((request) =>
          request.pipe(
            catchError((err) => {
              firstError ??= err;
              return of(null);
            }),
          ),
        ),
        finalize(() => {
          if (firstError) {
            this.toast.error(errorMessage(firstError, failureMessage));
            this.load();
          } else {
            done();
          }
        }),
      )
      .subscribe();
  }

  private getSelectedFiles(): FileMetadata[] {
    const ids = this.items()?.selectedIds() ?? new Set<string>();
    return this.files().filter((f) => ids.has(f.id));
  }

  private getSelectedFolders(): Folder[] {
    const ids = this.items()?.selectedFolderIds() ?? new Set<string>();
    return this.folders().filter((f) => ids.has(f.id));
  }
}
