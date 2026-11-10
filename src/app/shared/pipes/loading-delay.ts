import { ChangeDetectorRef, inject, OnDestroy, Pipe, PipeTransform } from '@angular/core';

/**
 * `loading | loadingDelay` turns true only once loading has lasted 200 ms, so quick
 * loads don't flash a placeholder. The app is zoneless, so when the timer fires the
 * pipe asks for a re-render itself; the timer starts once per loading period.
 */
@Pipe({ name: 'loadingDelay', standalone: true, pure: false })
export class LoadingDelayPipe implements PipeTransform, OnDestroy {
  private cdr = inject(ChangeDetectorRef);
  private displayed = false;
  private timeout?: ReturnType<typeof setTimeout>;

  transform(loading: boolean): boolean {
    if (!loading) {
      this.reset();
      return false;
    }
    if (!this.displayed && this.timeout === undefined) {
      this.timeout = setTimeout(() => {
        this.timeout = undefined;
        this.displayed = true;
        this.cdr.markForCheck();
      }, 200);
    }
    return this.displayed;
  }

  ngOnDestroy(): void {
    clearTimeout(this.timeout);
  }

  private reset(): void {
    clearTimeout(this.timeout);
    this.timeout = undefined;
    this.displayed = false;
  }
}
