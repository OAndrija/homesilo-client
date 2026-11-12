import { computed, effect, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type Theme = 'dark' | 'light';
/** What the user picked; 'system' follows the operating system's setting. */
export type ThemePreference = Theme | 'system';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private platformId = inject(PLATFORM_ID);
  private readonly STORAGE_KEY = 'hs-theme';
  private readonly media = isPlatformBrowser(this.platformId)
    ? window.matchMedia?.('(prefers-color-scheme: light)')
    : undefined;

  private readonly systemTheme = signal<Theme>(this.media?.matches ? 'light' : 'dark');

  readonly preference = signal<ThemePreference>(this.storedPreference());
  /** The theme actually applied. */
  readonly theme = computed<Theme>(() => {
    const pref = this.preference();
    return pref === 'system' ? this.systemTheme() : pref;
  });

  constructor() {
    this.media?.addEventListener?.('change', (e) =>
      this.systemTheme.set(e.matches ? 'light' : 'dark'),
    );

    effect(() => {
      const theme = this.theme();
      const pref = this.preference();
      if (!isPlatformBrowser(this.platformId)) return;
      document.documentElement.setAttribute('data-theme', theme);
      try {
        localStorage.setItem(this.STORAGE_KEY, pref);
      } catch {
        // Storage can be unavailable (private mode); the choice then lasts for this visit.
      }
    });
  }

  setPreference(preference: ThemePreference): void {
    this.preference.set(preference);
  }

  toggle(): void {
    this.preference.set(this.theme() === 'dark' ? 'light' : 'dark');
  }

  private storedPreference(): ThemePreference {
    if (!isPlatformBrowser(this.platformId)) return 'system';
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    } catch {
      // fall through to the system setting
    }
    return 'system';
  }
}
