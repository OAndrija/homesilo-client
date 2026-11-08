import {
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Auth } from '../../core/services/auth';
import { Theme, ThemeService } from '../../core/services/theme';

/** Avatar button in the top bar that opens the account menu (settings, theme, sign out). */
@Component({
  selector: 'app-account-menu',
  imports: [RouterLink],
  templateUrl: './account-menu.html',
  styleUrl: './account-menu.css',
})
export class AccountMenu {
  protected auth = inject(Auth);
  protected themeService = inject(ThemeService);
  private host = inject(ElementRef<HTMLElement>);

  private trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private panel = viewChild<ElementRef<HTMLElement>>('panel');

  open = signal(false);

  initial = computed(() => (this.auth.user()?.username ?? '?').charAt(0).toUpperCase());

  toggle(): void {
    if (this.open()) this.close();
    else this.show();
  }

  show(focusFirst = false): void {
    this.open.set(true);
    if (focusFirst) setTimeout(() => this.items()[0]?.focus());
  }

  close(returnFocus = false): void {
    this.open.set(false);
    if (returnFocus) this.trigger()?.nativeElement.focus();
  }

  setTheme(theme: Theme): void {
    this.themeService.theme.set(theme);
  }

  signOut(): void {
    this.close();
    this.auth.logout();
  }

  onTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.show(true);
    }
  }

  /** Arrow keys move between items; Escape and Tab close the menu. */
  onPanelKeydown(event: KeyboardEvent): void {
    const items = this.items();
    const index = items.indexOf(document.activeElement as HTMLElement);
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        items[(index + 1) % items.length]?.focus();
        break;
      case 'ArrowUp':
        event.preventDefault();
        items[(index - 1 + items.length) % items.length]?.focus();
        break;
      case 'Home':
        event.preventDefault();
        items[0]?.focus();
        break;
      case 'End':
        event.preventDefault();
        items[items.length - 1]?.focus();
        break;
      case 'Escape':
        event.preventDefault();
        this.close(true);
        break;
      case 'Tab':
        this.close();
        break;
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) this.close(true);
  }

  private items(): HTMLElement[] {
    const panel = this.panel()?.nativeElement;
    return panel ? Array.from(panel.querySelectorAll<HTMLElement>('[role^="menuitem"]')) : [];
  }
}
