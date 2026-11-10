import { Component, input } from '@angular/core';

/** Placeholder rows in the shape of the file table, shown while a list loads. */
@Component({
  selector: 'app-table-skeleton',
  templateUrl: './table-skeleton.html',
  styleUrl: './table-skeleton.css',
  host: { role: 'status', 'aria-label': 'Loading files' },
})
export class TableSkeleton {
  rows = input(8);

  /** Name widths vary so the placeholder reads as a list, not a grid. */
  private readonly widths = [46, 30, 58, 38, 52, 26, 42, 34, 48, 28];

  rowWidths(): number[] {
    return Array.from({ length: this.rows() }, (_, i) => this.widths[i % this.widths.length]);
  }
}
