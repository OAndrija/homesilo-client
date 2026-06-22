import { Component, input, output } from '@angular/core';

export type SelectionBarAction = 'download' | 'trash' | 'restore' | 'deleteForever' | 'star';

@Component({
  selector: 'app-selection-bar',
  templateUrl: './selection-bar.html',
  styleUrl: './selection-bar.css',
})
export class SelectionBar {
  selectedCount = input.required<number>();
  actions = input<SelectionBarAction[]>(['download', 'trash', 'star']);

  downloadAll = output();
  trashAll = output();
  restoreAll = output();
  starAll = output();
  deleteForeverAll = output();
  clearSelection = output();

  hasAction(action: SelectionBarAction): boolean {
    return this.actions().includes(action);
  }
}
