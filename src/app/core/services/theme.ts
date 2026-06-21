import { Injectable, signal, effect, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type Theme = 'dark' | 'light';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private platformId = inject(PLATFORM_ID);
  private readonly STORAGE_KEY = 'hs-theme';

  theme = signal<Theme>(this.getInitialTheme());

  constructor() {
    effect(() => {
      const t = this.theme();
      if (isPlatformBrowser(this.platformId)) {
        document.documentElement.setAttribute('data-theme', t);
        localStorage.setItem(this.STORAGE_KEY, t);
      }
    });
  }

  toggle(): void {
    this.theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  private getInitialTheme(): Theme {
    if (!isPlatformBrowser(this.platformId)) return 'dark';
    const stored = localStorage.getItem(this.STORAGE_KEY) as Theme | null;
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
}
