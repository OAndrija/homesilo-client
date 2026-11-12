import { Service, signal } from '@angular/core';
import { debounceTime, distinctUntilChanged, Subject, take } from 'rxjs';

@Service()
export class Search {
  /** What is typed in the search box, updated on every keystroke. */
  text = signal('');
  /** The debounced query that pages search with. */
  query = signal('');

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

  /** Empties the search box and the query; pages can call this too ("Clear search"). */
  clear(): void {
    this.text.set('');
    this.inputSubject.next('');
    this.query.set('');
  }
}
