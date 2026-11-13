import { Component, input, output } from '@angular/core';
import { SortKey, SortState } from '../../core/models/sort';

export type { FileView } from '../../core/services/list-settings';
import type { FileView } from '../../core/services/list-settings';

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
