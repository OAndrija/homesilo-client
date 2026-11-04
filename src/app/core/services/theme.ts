import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { computed, effect, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

export type Theme = 'dark' | 'light';
export type ThemePreference = Theme | 'system';

const STORAGE_KEY = 'hs-theme';

/** Applies the colour theme; "system" follows the operating system and updates live. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly document = inject(DOCUMENT);
  private readonly media = this.isBrowser
    ? this.document.defaultView?.matchMedia?.('(prefers-color-scheme: light)')
    : undefined;

  private readonly systemTheme = signal<Theme>(this.media?.matches ? 'light' : 'dark');
  readonly preference = signal<ThemePreference>(this.readPreference());
  readonly theme = computed<Theme>(() => {
    const preference = this.preference();
    return preference === 'system' ? this.systemTheme() : preference;
  });

  constructor() {
    this.media?.addEventListener?.('change', (event) =>
      this.systemTheme.set(event.matches ? 'light' : 'dark'),
    );

    effect(() => {
      if (!this.isBrowser) return;
      this.document.documentElement.setAttribute('data-theme', this.theme());
      try {
        localStorage.setItem(STORAGE_KEY, this.preference());
      } catch {
        // storage unavailable (private mode); the choice just won't persist
      }
    });
  }

  setPreference(preference: ThemePreference): void {
    this.preference.set(preference);
  }

  /** Flips between light and dark, leaving "system" mode. */
  toggle(): void {
    this.preference.set(this.theme() === 'dark' ? 'light' : 'dark');
  }

  private readPreference(): ThemePreference {
    if (!this.isBrowser) return 'system';
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    } catch {
      // ignore
    }
    return 'system';
  }
}
