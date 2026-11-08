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
