import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('follows the system setting until the user picks a theme', () => {
    const service = TestBed.inject(ThemeService);
    expect(service.preference()).toBe('system');
    // jsdom has no colour-scheme preference, so "system" resolves to dark.
    expect(service.theme()).toBe('dark');
  });

  it('applies and remembers an explicit choice', () => {
    const service = TestBed.inject(ThemeService);
    service.setPreference('light');
    TestBed.tick();
    expect(service.theme()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('hs-theme')).toBe('light');
  });

  it('restores a saved preference, including "system"', () => {
    localStorage.setItem('hs-theme', 'system');
    expect(TestBed.inject(ThemeService).preference()).toBe('system');
  });

  it('toggle switches between light and dark from whatever is showing', () => {
    const service = TestBed.inject(ThemeService);
    service.toggle();
    expect(service.preference()).toBe('light');
    service.toggle();
    expect(service.preference()).toBe('dark');
  });
});

describe('ThemeService themes', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-palette');
  });

  it('starts with the HomeSilo theme for each mode', () => {
    const service = TestBed.inject(ThemeService);
    expect(service.chosen()).toEqual({ light: 'homesilo-light', dark: 'homesilo-dark' });
    TestBed.tick();
    expect(document.documentElement.getAttribute('data-palette')).toBe('homesilo-dark');
  });

  it('picking a theme switches to its mode and remembers it', () => {
    const service = TestBed.inject(ThemeService);
    service.setPreference('light');
    service.setTheme('nord');
    TestBed.tick();
    expect(service.preference()).toBe('dark');
    expect(service.active().id).toBe('nord');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-palette')).toBe('nord');
    expect(localStorage.getItem('hs-theme-dark')).toBe('nord');
    expect(service.isChosen('nord')).toBe(true);
  });

  it('keeps following the system when a theme is picked', () => {
    const service = TestBed.inject(ThemeService);
    service.setTheme('github-light');
    expect(service.preference()).toBe('system');
    expect(service.chosen().light).toBe('github-light');
    // jsdom resolves "system" to dark, so the dark theme still shows.
    expect(service.active().id).toBe('homesilo-dark');
  });

  it('ignores unknown or mismatched saved themes', () => {
    localStorage.setItem('hs-theme-light', 'dracula');
    localStorage.setItem('hs-theme-dark', 'no-such-theme');
    const service = TestBed.inject(ThemeService);
    expect(service.chosen()).toEqual({ light: 'homesilo-light', dark: 'homesilo-dark' });
  });
});
