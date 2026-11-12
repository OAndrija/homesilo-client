import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import {
  ACCENTS,
  CARD_STYLES,
  CORNERS,
  FONTS,
  MOTIONS,
  SPACING,
  Theme,
  ThemeDefinition,
  ThemePreference,
  ThemeService,
} from '../../../core/services/theme';
import { ConfirmDialog } from '../../../shared/confirm-dialog/confirm-dialog';

/** Settings → Appearance: themes and everything else about how HomeSilo looks here. */
@Component({
  selector: 'app-appearance-settings',
  imports: [NgTemplateOutlet, ConfirmDialog],
  templateUrl: './appearance-settings.html',
  styleUrl: './appearance-settings.css',
})
export class AppearanceSettings {
  protected themeService = inject(ThemeService);

  readonly themeOptions: { value: ThemePreference; label: string; hint: string }[] = [
    { value: 'system', label: 'System', hint: 'Match your device' },
    { value: 'light', label: 'Light', hint: 'Always light' },
    { value: 'dark', label: 'Dark', hint: 'Always dark' },
  ];

  /** Narrows both theme lists by name. */
  query = signal('');

  readonly themeGroups = computed<
    { mode: Theme; title: string; hint: string; themes: readonly ThemeDefinition[] }[]
  >(() => {
    const q = this.query().trim().toLowerCase();
    const match = (t: ThemeDefinition) => !q || t.label.toLowerCase().includes(q);
    return [
      {
        mode: 'light' as const,
        title: 'Light theme',
        hint: 'Used in light mode.',
        themes: this.themeService.lightThemes.filter(match),
      },
      {
        mode: 'dark' as const,
        title: 'Dark theme',
        hint: 'Used in dark mode.',
        themes: this.themeService.darkThemes.filter(match),
      },
    ];
  });
  noThemeMatches = computed(() => this.themeGroups().every((g) => g.themes.length === 0));

  chosen = this.themeService.chosen;
  readonly cornerOptions = CORNERS;
  readonly spacingOptions = SPACING;
  readonly accentOptions = ACCENTS;
  readonly cardOptions = CARD_STYLES;
  readonly fontOptions = FONTS;
  readonly motionOptions = MOTIONS;

  confirmingReset = signal(false);

  setMode(preference: ThemePreference): void {
    this.themeService.setPreference(preference);
  }

  onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  closeReset(confirmed: boolean): void {
    this.confirmingReset.set(false);
    if (confirmed) this.themeService.resetAppearance();
  }
}
