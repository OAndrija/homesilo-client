import { Component, input, output } from '@angular/core';
import { SortKey, SortState } from '../../core/models/sort';

export type FileView = 'list' | 'grid';

/** Remembered per page, like the sort order. */
export function loadView(page: string): FileView {
  try {
    return localStorage.getItem(`hs-view-${page}`) === 'grid' ? 'grid' : 'list';
  } catch {
    return 'list';
  }
}

export function saveView(page: string, view: FileView): void {
  try {
    localStorage.setItem(`hs-view-${page}`, view);
  } catch {
    /* storage unavailable: the view just isn't remembered */
  }
}

/**
 * List / grid switch, plus a sort picker for the grid (the list sorts from its
 * column headers).
 */
@Component({
  selector: 'app-view-controls',
  templateUrl: './view-controls.html',
  styleUrl: './view-controls.css',
})
export class ViewControls {
  view = input.required<FileView>();
  sort = input<SortState | null>(null);
  /** Label for the date option, matching the table's column ("Modified", "Deleted"). */
  dateLabel = input('Modified');

  viewChange = output<FileView>();
  sortChange = output<SortState>();

  setKey(key: string): void {
    const current = this.sort();
    if (!current || (key !== 'name' && key !== 'size' && key !== 'date')) return;
    // Names start A–Z; sizes and dates start largest / newest.
    this.sortChange.emit({ key: key as SortKey, direction: key === 'name' ? 'asc' : 'desc' });
  }

  flipDirection(): void {
    const current = this.sort();
    if (current)
      this.sortChange.emit({ ...current, direction: current.direction === 'asc' ? 'desc' : 'asc' });
  }
}
