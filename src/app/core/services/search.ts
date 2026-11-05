import { Injectable, signal } from '@angular/core';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';

/**
 * The global search box. `text` mirrors the input immediately; `query` is the
 * debounced value pages search with.
 */
@Injectable({ providedIn: 'root' })
export class Search {
  readonly text = signal('');
  readonly query = signal('');

  private inputSubject = new Subject<string>();

  constructor() {
    this.inputSubject
      .pipe(debounceTime(200), distinctUntilChanged())
      .subscribe((value) => this.query.set(value));
  }

  setQuery(value: string): void {
    this.text.set(value);
    this.inputSubject.next(value);
  }

  clear(): void {
    this.text.set('');
    this.inputSubject.next('');
    this.query.set('');
  }
}
