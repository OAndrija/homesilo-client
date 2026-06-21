import { Component, input, output, computed } from '@angular/core';

export type SelectionBarAction = 'download' | 'open' | 'trash' | 'restore' | 'deleteForever' | 'star';

@Component({
  selector: 'app-selection-bar',
  templateUrl: './selection-bar.html',
  styleUrl: './selection-bar.css',
})
export class SelectionBar {
  selectedCount = input.required<number>();
  actions = input<SelectionBarAction[]>(['download', 'open', 'trash', 'star']);

  downloadAll = output();
  openAll = output();
  trashAll = output();
  restoreAll = output();
  deleteForeverAll = output();
  clearSelection = output();

  hasAction(action: SelectionBarAction): boolean {
    return this.actions().includes(action);
  }
}
