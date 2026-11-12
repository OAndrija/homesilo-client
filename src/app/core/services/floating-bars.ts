import { Injectable, signal } from '@angular/core';

/**
 * Bars that float over the bottom of the page. Toasts share the bottom centre with
 * the selection bar, so they move up while it is showing.
 */
@Injectable({ providedIn: 'root' })
export class FloatingBars {
  readonly selectionBarOpen = signal(false);
}
