import { Service, signal } from '@angular/core';
import { debounceTime, distinctUntilChanged, Subject, take } from 'rxjs';

@Service()
export class Search {
  query = signal('');

  private inputSubject =  new Subject<string>();

  constructor() {
    this.inputSubject
      .pipe(debounceTime(200), distinctUntilChanged())
      .subscribe((value) => this.query.set(value));
  }

  setQuery(value: string): void {
    this.inputSubject.next(value);
  }

  clear(): void {
    this.inputSubject.next('');
    this.query.set('');
  }

}
