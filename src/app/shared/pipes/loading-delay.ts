import { Pipe, PipeTransform, OnDestroy } from '@angular/core';

@Pipe({ name: 'loadingDelay', standalone: true, pure: false })
export class LoadingDelayPipe implements PipeTransform, OnDestroy {
  private displayed = false;
  private timeout?: ReturnType<typeof setTimeout>;

  transform(loading: boolean): boolean {
    if (!loading) {
      clearTimeout(this.timeout);
      this.displayed = false;
      return false;
    }
    if (!this.displayed) {
      clearTimeout(this.timeout);
      this.timeout = setTimeout(() => {
        this.displayed = true;
      }, 200);
    }
    return this.displayed;
  }

  ngOnDestroy(): void {
    clearTimeout(this.timeout);
  }
}
