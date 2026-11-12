import { afterNextRender, DestroyRef, Directive, ElementRef, inject, signal } from '@angular/core';

/**
 * Reports the size of the element it sits on, as a signal. Content placed in
 * the area absolutely can then be laid out to fill it, without its own size
 * feeding back into the area's size.
 */
@Directive({ selector: '[appFitArea]', exportAs: 'fitArea' })
export class FitArea {
  readonly size = signal({ width: 0, height: 0 });

  constructor() {
    const el: HTMLElement = inject(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.size.set({ width: el.clientWidth, height: el.clientHeight });
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(([entry]) => {
        const { width, height } = entry.contentRect;
        const now = this.size();
        if (Math.abs(now.width - width) >= 1 || Math.abs(now.height - height) >= 1) {
          this.size.set({ width, height });
        }
      });
      observer.observe(el);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
