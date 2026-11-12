import { Component, DestroyRef, effect, inject, input, output } from '@angular/core';
import { FloatingBars } from '../../core/services/floating-bars';

export type SelectionBarAction =
  | 'download'
  | 'trash'
  | 'restore'
  | 'deleteForever'
  | 'star'
  | 'move';

@Component({
  selector: 'app-selection-bar',
  templateUrl: './selection-bar.html',
  styleUrl: './selection-bar.css',
})
export class SelectionBar {
  selectedCount = input.required<number>();
  actions = input<SelectionBarAction[]>(['download', 'trash', 'star']);
  /** Everything selected is starred, so the star button offers to unstar. */
  starred = input(false);

  downloadAll = output();
  trashAll = output();
  restoreAll = output();
  starAll = output();
  deleteForeverAll = output();
  clearSelection = output();
  moveAll = output();

  constructor() {
    const bars = inject(FloatingBars);
    effect(() => bars.selectionBarOpen.set(this.selectedCount() > 0));
    inject(DestroyRef).onDestroy(() => bars.selectionBarOpen.set(false));
  }

  hasAction(action: SelectionBarAction): boolean {
    return this.actions().includes(action);
  }
}
